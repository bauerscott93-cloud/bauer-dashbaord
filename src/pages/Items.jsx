import { PhasePlaceholder } from '../components/PhasePlaceholder.jsx'

export default function Items() {
  return (
    <PhasePlaceholder title="All Items" phase={2}>
      <li>Table with search, filters, and sorting</li>
      <li>Full add / edit / delete, with a confirmation step on delete</li>
      <li>Bulk “mark done”, rolling recurring items forward to the next occurrence</li>
      <li>Completion history per item, and a “Recently deleted” view for 30 days</li>
    </PhasePlaceholder>
  )
}
