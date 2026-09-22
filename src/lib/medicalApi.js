import { supabase } from './supabase.js'

/**
 * Data access for the medical bills module. Thin wrappers over Supabase so the
 * hooks stay about state and the components stay about rendering.
 *
 * Every read filters out soft-deleted rows. RLS already scopes everything to
 * the household, but queries pass household_id explicitly so an accidental
 * cross-household write fails loudly rather than silently returning nothing.
 */

const live = (query) => query.is('deleted_at', null)

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchMedicalData(householdId) {
  const [patients, providers, plans, bills, eobs, links] = await Promise.all([
    live(supabase.from('patients').select('*').eq('household_id', householdId)).order('full_name'),
    live(supabase.from('providers').select('*').eq('household_id', householdId)).order('name'),
    live(supabase.from('insurance_plans').select('*').eq('household_id', householdId))
      .order('plan_year', { ascending: false }),
    live(supabase.from('medical_bills').select('*').eq('household_id', householdId))
      .order('due_date', { ascending: true, nullsFirst: false }),
    live(supabase.from('eobs').select('*').eq('household_id', householdId))
      .order('date_of_service', { ascending: false }),
    supabase.from('bill_eob_links').select('*').eq('household_id', householdId),
  ])

  return {
    patients: unwrap(patients) ?? [],
    providers: unwrap(providers) ?? [],
    plans: unwrap(plans) ?? [],
    bills: unwrap(bills) ?? [],
    eobs: unwrap(eobs) ?? [],
    links: unwrap(links) ?? [],
  }
}

export async function fetchActivity(billId) {
  return unwrap(
    await supabase
      .from('bill_activity')
      .select('*')
      .eq('bill_id', billId)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false }),
  ) ?? []
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export async function createBill(householdId, values) {
  return unwrap(
    await supabase
      .from('medical_bills')
      .insert({ ...values, household_id: householdId })
      .select()
      .single(),
  )
}

export async function updateBill(id, values) {
  return unwrap(await supabase.from('medical_bills').update(values).eq('id', id).select().single())
}

/**
 * Soft delete, so a mis-click is recoverable from "Recently deleted" for 30
 * days rather than gone.
 */
export async function softDeleteBill(id) {
  return updateBill(id, { deleted_at: new Date().toISOString() })
}

export async function restoreBill(id) {
  return unwrap(
    await supabase.from('medical_bills').update({ deleted_at: null }).eq('id', id).select().single(),
  )
}

/**
 * Record the action the user chose. `reason` is stored alongside so the board
 * still explains itself after an override.
 */
export async function setBillAction(id, action, reason = null) {
  const patch = { action }
  if (reason !== null) patch.action_reason = reason
  return updateBill(id, patch)
}

export async function markBillPaid(householdId, bill, { amount, paidOn }) {
  const paid = Number(bill.amount_paid ?? 0) + Number(amount ?? 0)
  const updated = await updateBill(bill.id, { amount_paid: paid, action: 'paid' })
  await logActivity(householdId, bill.id, {
    activity_type: 'payment',
    occurred_on: paidOn,
    amount,
    body: `Paid ${amount}.`,
  })
  return updated
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export async function logActivity(householdId, billId, values) {
  return unwrap(
    await supabase
      .from('bill_activity')
      .insert({ ...values, bill_id: billId, household_id: householdId })
      .select()
      .single(),
  )
}

// ---------------------------------------------------------------------------
// EOBs and their links to bills
// ---------------------------------------------------------------------------

export async function createEob(householdId, values) {
  return unwrap(
    await supabase.from('eobs').insert({ ...values, household_id: householdId }).select().single(),
  )
}

export async function updateEob(id, values) {
  return unwrap(await supabase.from('eobs').update(values).eq('id', id).select().single())
}

export async function softDeleteEob(id) {
  return updateEob(id, { deleted_at: new Date().toISOString() })
}

/**
 * Linking an EOB also copies its patient responsibility onto the bill and
 * marks the EOB as received — that combination is what rules 3 and 4 read.
 */
export async function linkEobToBill(householdId, billId, eob) {
  unwrap(
    await supabase
      .from('bill_eob_links')
      .upsert(
        { household_id: householdId, bill_id: billId, eob_id: eob.id },
        { onConflict: 'bill_id,eob_id' },
      )
      .select(),
  )

  return updateBill(billId, {
    eob_received: true,
    patient_responsibility_per_eob: eob.patient_responsibility,
    insurance_status: 'processed',
    claim_number: eob.claim_number ?? undefined,
  })
}

export async function unlinkEobFromBill(billId, eobId) {
  const { error } = await supabase
    .from('bill_eob_links')
    .delete()
    .eq('bill_id', billId)
    .eq('eob_id', eobId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Patients and providers — created on the fly by quick add and CSV import
// ---------------------------------------------------------------------------

export async function createPatient(householdId, fullName) {
  return unwrap(
    await supabase
      .from('patients')
      .insert({ household_id: householdId, full_name: fullName.trim() })
      .select()
      .single(),
  )
}

export async function createProvider(householdId, values) {
  const payload = typeof values === 'string' ? { name: values.trim() } : values
  return unwrap(
    await supabase
      .from('providers')
      .insert({ household_id: householdId, ...payload })
      .select()
      .single(),
  )
}

export async function updatePatient(id, values) {
  return unwrap(await supabase.from('patients').update(values).eq('id', id).select().single())
}

export async function updateProvider(id, values) {
  return unwrap(await supabase.from('providers').update(values).eq('id', id).select().single())
}

export async function softDeletePatient(id) {
  return updatePatient(id, { deleted_at: new Date().toISOString() })
}

export async function softDeleteProvider(id) {
  return updateProvider(id, { deleted_at: new Date().toISOString() })
}

// ---------------------------------------------------------------------------
// Insurance plans
// ---------------------------------------------------------------------------

export async function createPlan(householdId, values) {
  return unwrap(
    await supabase
      .from('insurance_plans')
      .insert({ ...values, household_id: householdId })
      .select()
      .single(),
  )
}

export async function updatePlan(id, values) {
  return unwrap(await supabase.from('insurance_plans').update(values).eq('id', id).select().single())
}

export async function softDeletePlan(id) {
  return updatePlan(id, { deleted_at: new Date().toISOString() })
}

/**
 * Case-insensitive lookup used by quick add and CSV import so typing an
 * existing provider doesn't create a second copy of it.
 */
export function findByName(rows, name, field = 'name') {
  if (!name) return null
  const needle = String(name).trim().toLowerCase()
  return rows.find((row) => String(row[field] ?? '').trim().toLowerCase() === needle) ?? null
}
