import { PhasePlaceholder } from '../components/PhasePlaceholder.jsx'

export default function MedicalBills() {
  return (
    <PhasePlaceholder title="Medical Bills" phase={3}>
      <li>Triage board: Pay Now / Waiting / Needs a Call / Dispute / Ignore / Done</li>
      <li>Suggested action computed from the triage rules, always overridable</li>
      <li>Mismatch and duplicate flags, summary bar, deductible and OOP progress</li>
      <li>Bill detail drawer with side-by-side EOB comparison and activity log</li>
      <li>Quick add, CSV import with a preview, and document uploads</li>
    </PhasePlaceholder>
  )
}
