import { PhasePlaceholder } from '../components/PhasePlaceholder.jsx'

export default function Dashboard() {
  return (
    <PhasePlaceholder title="Dashboard" phase={2}>
      <li>Overdue (red), due in the next 7 days, due in the next 30 days</li>
      <li>Medical bills summary: amount due now, count needing a call, follow-ups due</li>
      <li>“Coming up this quarter” — taxes, property tax, semiannual items</li>
      <li>Filter chips by category</li>
    </PhasePlaceholder>
  )
}
