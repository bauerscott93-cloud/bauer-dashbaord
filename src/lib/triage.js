/**
 * Medical bill triage.
 *
 * Pure functions: given a bill and what we know around it, say what to do and
 * why. The app always shows this as a *suggestion* — whatever is stored in
 * `bill.action` wins, so an override is never second-guessed.
 */

import { daysUntil } from './dates.js'

/** A statement and an EOB within this much of each other are "the same". */
const AMOUNT_TOLERANCE = 0.01

/** Two statements this close in amount are treated as a possible duplicate. */
const DUPLICATE_TOLERANCE = 1.0

/** Rule 8: an unpaid bill due this soon is urgent. */
const URGENT_WINDOW_DAYS = 14

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * What we still owe: the EOB's number when we have one, otherwise whatever the
 * statement claims, minus anything already paid. Mirrors the generated
 * `balance` column so the UI agrees with the database.
 */
export function billBalance(bill) {
  const owed = bill.patient_responsibility_per_eob ?? bill.amount_billed
  return num(owed) - num(bill.amount_paid)
}

/**
 * Rule 6 — possible duplicates: same provider, same date of service, and a
 * near-identical amount.
 *
 * Returns a Map of bill id -> array of the other bills it collides with.
 * Every bill in a colliding group is flagged, so the pair is visible. Which
 * one gets the `ignore` suggestion is decided in suggestAction(): the newest
 * statement is the likely re-send, and the original keeps normal triage. That
 * way a duplicate never buries the real bill.
 */
export function findDuplicates(bills) {
  const groups = new Map()

  for (const bill of bills) {
    if (!bill.provider_id || !bill.date_of_service) continue
    const key = `${bill.provider_id}|${bill.date_of_service}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(bill)
  }

  const duplicatesById = new Map()

  for (const group of groups.values()) {
    if (group.length < 2) continue
    for (const bill of group) {
      const matches = group.filter(
        (other) =>
          other.id !== bill.id &&
          Math.abs(num(other.amount_billed) - num(bill.amount_billed)) <= DUPLICATE_TOLERANCE,
      )
      if (matches.length > 0) duplicatesById.set(bill.id, matches)
    }
  }

  return duplicatesById
}

/** Sort key for "which statement arrived last" — the likely re-send. */
function statementOrder(bill) {
  return bill.statement_date || bill.created_at || ''
}

/**
 * The suggested action for one bill.
 *
 * @param {object} bill
 * @param {object} context
 * @param {object} [context.provider]   the bill's provider row (for in_network)
 * @param {object} [context.eob]        the linked EOB, if any
 * @param {Array}  [context.duplicates] other bills this one collides with
 * @returns {{action: string, reason: string, flags: object}}
 */
export function suggestAction(bill, context = {}) {
  const { provider, eob, duplicates = [] } = context

  const balance = billBalance(bill)
  const billed = num(bill.amount_billed)
  const responsibility = bill.patient_responsibility_per_eob
  const hasEob = Boolean(bill.eob_received || eob)
  const days = bill.due_date ? daysUntil(bill.due_date) : null

  const flags = {
    duplicate: duplicates.length > 0,
    mismatch: false,
    overdue: false,
    urgent: false,
  }

  // Rule 3 (flag half): the statement says one thing, the EOB says another.
  if (hasEob && responsibility !== null && responsibility !== undefined) {
    flags.mismatch = num(responsibility) < billed - AMOUNT_TOLERANCE
  }

  const decided = (action, reason) => {
    // Rule 8: due soon and actually payable.
    if (action === 'pay' && days !== null) {
      flags.overdue = days < 0
      flags.urgent = days <= URGENT_WINDOW_DAYS
    }
    return { action, reason, flags }
  }

  // --- Rule 7: nothing left to owe -----------------------------------------
  if (balance <= AMOUNT_TOLERANCE) {
    return num(bill.amount_paid) > 0
      ? decided('paid', 'Paid in full — nothing outstanding.')
      : decided('resolved', 'Balance is $0. Nothing owed.')
  }

  // --- Rule 6: possible duplicate ------------------------------------------
  // Only the latest statement in the group is suggested for ignoring; the
  // original stays in normal triage so the real bill doesn't get buried.
  if (duplicates.length > 0) {
    const isNewest = duplicates.every(
      (other) => statementOrder(bill) >= statementOrder(other),
    )
    if (isNewest) {
      return decided(
        'ignore',
        'Possible duplicate — same provider, same date of service, same amount as an ' +
          'earlier statement. Confirm before paying.',
      )
    }
  }

  // --- Rule 5: claim denied -------------------------------------------------
  if (bill.insurance_status === 'denied') {
    return decided('dispute', 'Insurance denied the claim. Appeal it before paying anything.')
  }

  // --- Rule 3: EOB and statement disagree -----------------------------------
  if (flags.mismatch) {
    return decided(
      'call_provider',
      `Statement says $${billed.toFixed(2)} but the EOB says you owe ` +
        `$${num(responsibility).toFixed(2)}. Ask for a corrected statement.`,
    )
  }

  // --- Rule 4: EOB agrees with the statement --------------------------------
  if (hasEob && responsibility !== null && responsibility !== undefined) {
    return decided('pay', 'EOB matches the statement. This is genuinely owed.')
  }

  // --- Rule 2: submitted, waiting on the EOB --------------------------------
  if (bill.insurance_status === 'submitted') {
    return decided(
      'wait_for_eob',
      'Submitted to insurance, no EOB yet. Don’t pay until the EOB lands.',
    )
  }

  // Processed but we haven't recorded the EOB.
  if (bill.insurance_status === 'processed' && !hasEob) {
    return decided(
      'wait_for_eob',
      'Insurance processed this but no EOB is recorded. Find it before paying.',
    )
  }

  // --- Rule 1: nothing submitted --------------------------------------------
  if (bill.insurance_status === 'not_submitted') {
    return provider?.in_network === false
      ? decided(
          'call_provider',
          'Out of network and not submitted. Ask whether they’ll bill insurance ' +
            'or you need to submit the claim yourself.',
        )
      : decided('call_provider', 'No insurance submission recorded. Confirm they billed insurance.')
  }

  // Self-pay: there is no insurance step to wait for.
  if (bill.insurance_status === 'not_applicable') {
    return decided('pay', 'Insurance doesn’t apply. This is self-pay.')
  }

  return decided('call_provider', 'Not enough information to decide. Call and ask.')
}

/**
 * Run triage across a whole set of bills at once, so the duplicate check can
 * see every bill rather than one at a time.
 *
 * Returns the bills decorated with `suggestion`, `effectiveAction` (the
 * override if there is one, else the suggestion) and `balance`.
 */
export function triageBills(bills, { providers = [], eobsByBillId = new Map() } = {}) {
  const providersById = new Map(providers.map((p) => [p.id, p]))
  const duplicatesById = findDuplicates(bills)

  return bills.map((bill) => {
    const suggestion = suggestAction(bill, {
      provider: providersById.get(bill.provider_id),
      eob: eobsByBillId.get(bill.id),
      duplicates: duplicatesById.get(bill.id) ?? [],
    })

    const effectiveAction = bill.action ?? suggestion.action
    const balance = billBalance(bill)
    const days = bill.due_date ? daysUntil(bill.due_date) : null

    return {
      ...bill,
      balance,
      suggestion,
      effectiveAction,
      isOverridden: Boolean(bill.action) && bill.action !== suggestion.action,
      flags: {
        ...suggestion.flags,
        // Recompute against the action actually in force, not the suggestion.
        overdue: effectiveAction === 'pay' && days !== null && days < 0,
        urgent:
          effectiveAction === 'pay' && days !== null && days <= URGENT_WINDOW_DAYS && days >= 0,
      },
    }
  })
}

/** The six board columns, and which actions land in each. */
export const TRIAGE_COLUMNS = [
  { key: 'pay',     title: 'Pay Now',      actions: ['pay'],                               tone: 'rose' },
  { key: 'waiting', title: 'Waiting',      actions: ['wait_for_insurance', 'wait_for_eob', 'verify_paid'], tone: 'slate' },
  { key: 'call',    title: 'Needs a Call', actions: ['call_provider'],                      tone: 'amber' },
  { key: 'dispute', title: 'Dispute',      actions: ['dispute'],                            tone: 'violet' },
  { key: 'ignore',  title: 'Ignore',       actions: ['ignore'],                             tone: 'slate' },
  { key: 'done',    title: 'Done',         actions: ['paid', 'resolved'],                   tone: 'emerald' },
]

/** Dropping a card on a column sets this action. */
export const COLUMN_DEFAULT_ACTION = {
  pay: 'pay',
  waiting: 'wait_for_eob',
  call: 'call_provider',
  dispute: 'dispute',
  ignore: 'ignore',
  done: 'paid',
}

export function columnForAction(action) {
  return TRIAGE_COLUMNS.find((c) => c.actions.includes(action))?.key ?? 'call'
}

/** Totals for the summary bar. */
export function summarize(triaged) {
  const totals = {
    outstanding: 0,
    dueNow: 0,
    inLimbo: 0,
    underDispute: 0,
    paidYtd: 0,
    needsCall: 0,
    followUpsDue: 0,
    mismatches: 0,
    duplicates: 0,
  }

  const yearStart = `${new Date().getFullYear()}-01-01`
  const today = new Date().toISOString().slice(0, 10)

  for (const bill of triaged) {
    const balance = num(bill.balance)
    if (balance > 0) totals.outstanding += balance

    switch (bill.effectiveAction) {
      case 'pay':
        totals.dueNow += balance
        break
      case 'wait_for_eob':
      case 'wait_for_insurance':
      // Money we may already have paid is just as much in limbo as money
      // waiting on an insurer.
      case 'verify_paid':
        totals.inLimbo += balance
        break
      case 'dispute':
        totals.underDispute += balance
        break
      case 'call_provider':
        totals.needsCall += 1
        break
      default:
        break
    }

    // "YTD paid" counts what was paid, using the statement date as the best
    // available proxy for when — there is no payment date on the bill itself.
    const paidOn = bill.statement_date || bill.date_of_service
    if (num(bill.amount_paid) > 0 && (!paidOn || paidOn >= yearStart)) {
      totals.paidYtd += num(bill.amount_paid)
    }

    if (bill.follow_up_date && bill.follow_up_date <= today) totals.followUpsDue += 1
    if (bill.flags?.mismatch) totals.mismatches += 1
    if (bill.flags?.duplicate) totals.duplicates += 1
  }

  return totals
}
