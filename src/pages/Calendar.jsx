import { PhasePlaceholder } from '../components/PhasePlaceholder.jsx'

export default function Calendar() {
  return (
    <PhasePlaceholder title="Calendar" phase={2}>
      <li>Read-only month grid of due dates</li>
      <li>Click a date to open the item</li>
      <li>Medical follow-up dates alongside item due dates</li>
    </PhasePlaceholder>
  )
}
