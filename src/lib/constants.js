/** Option lists mirroring the database enums, with the labels the UI shows. */

export const CATEGORIES = [
  { value: 'bill',             label: 'Bill' },
  { value: 'tax',              label: 'Tax' },
  { value: 'property',         label: 'Property' },
  { value: 'home_maintenance', label: 'Home maintenance' },
  { value: 'vehicle',          label: 'Vehicle' },
  { value: 'travel',           label: 'Travel' },
  { value: 'business',         label: 'Business' },
  { value: 'insurance',        label: 'Insurance' },
  { value: 'subscription',     label: 'Subscription' },
  { value: 'other',            label: 'Other' },
]

export const RECURRENCES = [
  { value: 'none',       label: 'One-time' },
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'semiannual', label: 'Twice a year' },
  { value: 'annual',     label: 'Yearly' },
  { value: 'custom',     label: 'Custom…' },
]

export const RECURRENCE_UNITS = [
  { value: 'day',   label: 'days' },
  { value: 'week',  label: 'weeks' },
  { value: 'month', label: 'months' },
]

export const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
]

export const ITEM_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done',     label: 'Done' },
  { value: 'skipped',  label: 'Skipped' },
]

export const INSURANCE_STATUSES = [
  { value: 'not_submitted',  label: 'Not submitted' },
  { value: 'submitted',      label: 'Submitted' },
  { value: 'processed',      label: 'Processed' },
  { value: 'denied',         label: 'Denied' },
  { value: 'not_applicable', label: 'Not applicable' },
]

export const BILL_ACTIONS = [
  { value: 'pay',                label: 'Pay',              column: 'Pay Now' },
  { value: 'wait_for_insurance', label: 'Wait (insurance)', column: 'Waiting' },
  { value: 'wait_for_eob',       label: 'Wait for EOB',     column: 'Waiting' },
  { value: 'verify_paid',        label: 'Check if already paid', column: 'Waiting' },
  { value: 'call_provider',      label: 'Call provider',    column: 'Needs a Call' },
  { value: 'dispute',            label: 'Dispute',          column: 'Dispute' },
  { value: 'ignore',             label: 'Ignore',           column: 'Ignore' },
  { value: 'paid',               label: 'Paid',             column: 'Done' },
  { value: 'resolved',           label: 'Resolved',         column: 'Done' },
]

export const REIMBURSEMENT_STATUSES = [
  { value: 'n/a',        label: 'Not applicable' },
  { value: 'to_submit',  label: 'To submit' },
  { value: 'submitted',  label: 'Submitted' },
  { value: 'reimbursed', label: 'Reimbursed' },
]

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))
export const RECURRENCE_LABELS = Object.fromEntries(RECURRENCES.map((r) => [r.value, r.label]))
export const BILL_ACTION_LABELS = Object.fromEntries(BILL_ACTIONS.map((a) => [a.value, a.label]))
export const INSURANCE_STATUS_LABELS =
  Object.fromEntries(INSURANCE_STATUSES.map((s) => [s.value, s.label]))
