import { triageBills, summarize, findDuplicates } from '../src/lib/triage.js'

const today = new Date()
const iso = (offset) => {
  const d = new Date(today); d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const providers = [
  { id: 'p-scripps', name: 'Scripps Clinic', in_network: true },
  { id: 'p-sharp', name: 'Sharp Rees-Stealy', in_network: true },
  { id: 'p-rad', name: 'San Diego Radiology Associates', in_network: false },
]

// Mirrors exactly what 0007's seed inserts.
const bills = [
  { id: 'A', provider_id: 'p-scripps', date_of_service: iso(-70), statement_date: iso(-40),
    due_date: iso(5), amount_billed: 842.00, insurance_status: 'processed', eob_received: true,
    patient_responsibility_per_eob: 120.00, amount_paid: 0, action: null },
  { id: 'B', provider_id: 'p-sharp', date_of_service: iso(-51), statement_date: iso(-30),
    due_date: iso(10), amount_billed: 275.00, insurance_status: 'not_submitted', eob_received: false,
    patient_responsibility_per_eob: null, amount_paid: 0, action: null },
  { id: 'C', provider_id: 'p-sharp', date_of_service: iso(-51), statement_date: iso(-20),
    due_date: iso(20), amount_billed: 275.00, insurance_status: 'not_submitted', eob_received: false,
    patient_responsibility_per_eob: null, amount_paid: 0, action: null },
  { id: 'D', provider_id: 'p-rad', date_of_service: iso(-30), statement_date: iso(-12),
    due_date: iso(25), amount_billed: 410.00, insurance_status: 'submitted', eob_received: false,
    patient_responsibility_per_eob: null, amount_paid: 0, action: null },
]

let pass = 0, fail = 0
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`}`)
}

const t = triageBills(bills, { providers })
const by = Object.fromEntries(t.map((b) => [b.id, b]))

console.log('--- seeded bills ---')
check('A: mismatch flagged (rule 3)', by.A.flags.mismatch, true)
check('A: suggests call_provider', by.A.effectiveAction, 'call_provider')
check('A: balance uses EOB responsibility', by.A.balance, 120)
check('B: flagged duplicate (rule 6)', by.B.flags.duplicate, true)
check('C: flagged duplicate (rule 6)', by.C.flags.duplicate, true)
check('C: newest statement suggests ignore', by.C.effectiveAction, 'ignore')
check('B: original still triaged normally, not buried', by.B.effectiveAction, 'call_provider')
check('D: submitted, no EOB -> wait_for_eob (rule 2)', by.D.effectiveAction, 'wait_for_eob')

console.log('\n--- other rules ---')
const one = (bill, ctx = {}) => triageBills([bill], { providers, ...ctx })[0]

check('rule 7: zero balance -> resolved',
  one({ id: 'z', amount_billed: 100, amount_paid: 0, patient_responsibility_per_eob: 0,
        insurance_status: 'processed', eob_received: true }).effectiveAction, 'resolved')
check('rule 7: fully paid -> paid',
  one({ id: 'z2', amount_billed: 100, amount_paid: 100, insurance_status: 'processed' }).effectiveAction, 'paid')
check('rule 5: denied -> dispute',
  one({ id: 'z3', amount_billed: 300, amount_paid: 0, insurance_status: 'denied' }).effectiveAction, 'dispute')
check('rule 4: EOB matches -> pay',
  one({ id: 'z4', amount_billed: 150, patient_responsibility_per_eob: 150, amount_paid: 0,
        insurance_status: 'processed', eob_received: true }).effectiveAction, 'pay')
check('rule 1: not submitted, in-network -> call_provider',
  one({ id: 'z5', provider_id: 'p-sharp', amount_billed: 90, amount_paid: 0,
        insurance_status: 'not_submitted' }).effectiveAction, 'call_provider')
check('out-of-network unsubmitted -> call_provider',
  one({ id: 'z6', provider_id: 'p-rad', amount_billed: 90, amount_paid: 0,
        insurance_status: 'not_submitted' }).effectiveAction, 'call_provider')
check('not_applicable -> pay (self-pay)',
  one({ id: 'z7', amount_billed: 60, amount_paid: 0, insurance_status: 'not_applicable' }).effectiveAction, 'pay')
check('partial payment leaves a balance',
  one({ id: 'z8', amount_billed: 100, amount_paid: 40, insurance_status: 'not_applicable' }).balance, 60)

console.log('\n--- rule 8: urgency ---')
check('due in 5 days + pay -> urgent',
  one({ id: 'u1', amount_billed: 50, amount_paid: 0, insurance_status: 'not_applicable', due_date: iso(5) }).flags.urgent, true)
check('due in 40 days + pay -> not urgent',
  one({ id: 'u2', amount_billed: 50, amount_paid: 0, insurance_status: 'not_applicable', due_date: iso(40) }).flags.urgent, false)
check('past due + pay -> overdue',
  one({ id: 'u3', amount_billed: 50, amount_paid: 0, insurance_status: 'not_applicable', due_date: iso(-3) }).flags.overdue, true)
check('waiting bill due soon is NOT urgent',
  one({ id: 'u4', amount_billed: 50, amount_paid: 0, insurance_status: 'submitted', due_date: iso(3) }).flags.urgent, false)

console.log('\n--- overrides ---')
const ov = one({ id: 'o1', amount_billed: 200, amount_paid: 0, insurance_status: 'submitted', action: 'pay' })
check('override wins over suggestion', ov.effectiveAction, 'pay')
check('override is marked as such', ov.isOverridden, true)
check('suggestion still visible underneath', ov.suggestion.action, 'wait_for_eob')

console.log('\n--- duplicate edge cases ---')
check('different amounts are not duplicates',
  findDuplicates([{ id: 'x', provider_id: 'p', date_of_service: '2026-01-01', amount_billed: 100 },
                  { id: 'y', provider_id: 'p', date_of_service: '2026-01-01', amount_billed: 400 }]).size, 0)
check('different dates are not duplicates',
  findDuplicates([{ id: 'x', provider_id: 'p', date_of_service: '2026-01-01', amount_billed: 100 },
                  { id: 'y', provider_id: 'p', date_of_service: '2026-02-01', amount_billed: 100 }]).size, 0)
check('missing date of service never duplicates',
  findDuplicates([{ id: 'x', provider_id: 'p', date_of_service: null, amount_billed: 100 },
                  { id: 'y', provider_id: 'p', date_of_service: null, amount_billed: 100 }]).size, 0)

console.log('\n--- summary bar ---')
const s = summarize(t)
check('due now = $0 (nothing is action=pay)', s.dueNow, 0)
check('in limbo = D only', s.inLimbo, 410)
check('needs a call = A and B', s.needsCall, 2)
check('outstanding = 120 + 275 + 275 + 410', s.outstanding, 1080)
check('mismatches counted', s.mismatches, 1)
check('duplicates counted', s.duplicates, 2)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
