/**
 * Date helpers. Everything in the database is a `date` (no time, no timezone),
 * so dates are handled as plain 'YYYY-MM-DD' strings and only turned into a
 * Date at local noon — which keeps a DST shift from moving a day.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DAY_MS = 86400000

/** 'YYYY-MM-DD' for today, in the browser's own timezone. */
export function todayISO() {
  return toISO(new Date())
}

/** A Date (local) -> 'YYYY-MM-DD'. */
export function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 'YYYY-MM-DD' -> Date at local noon. Parsing with `new Date(str)` would read
 * it as UTC midnight and show the previous day west of Greenwich.
 */
export function parseISO(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d, 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

/** True when the string is a real calendar date, e.g. rejects 2026-02-31. */
export function isValidISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '').trim())) return false
  const [y, m, d] = String(iso).split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/** "Mon DD, YYYY" */
export function formatDate(iso, { blank = '—' } = {}) {
  const date = parseISO(iso)
  if (!date) return blank
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/** "Mon DD" — for dense tables and the calendar grid. */
export function formatDateShort(iso, { blank = '—' } = {}) {
  const date = parseISO(iso)
  if (!date) return blank
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

/** Whole days from today to `iso`. Negative means overdue. */
export function daysUntil(iso, from = todayISO()) {
  const a = parseISO(from)
  const b = parseISO(iso)
  if (!a || !b) return null
  return Math.round((b - a) / DAY_MS)
}

/** "in 5 days" / "3 days overdue" / "today" / "tomorrow" / "yesterday" */
export function relativeDay(iso, from = todayISO()) {
  const days = daysUntil(iso, from)
  if (days === null) return ''
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 0) {
    if (days < 45) return `in ${days} days`
    const months = Math.round(days / 30)
    return months < 12 ? `in ${months} months` : `in ${Math.round(days / 365)} yr`
  }
  const overdue = Math.abs(days)
  if (overdue < 45) return `${overdue} days overdue`
  const months = Math.round(overdue / 30)
  return months < 12 ? `${months} months overdue` : `${Math.round(overdue / 365)} yr overdue`
}

export function addDays(iso, days) {
  const date = parseISO(iso)
  if (!date) return null
  date.setDate(date.getDate() + days)
  return toISO(date)
}

export function addMonths(iso, months) {
  const date = parseISO(iso)
  if (!date) return null
  const targetDay = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  // Clamp: Jan 31 + 1 month is Feb 28/29, not Mar 2/3.
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(targetDay, lastDay))
  return toISO(date)
}

/** Urgency bucket used for the red / amber / gray / green colour signals. */
export function urgency(iso, { done = false, autopay = false, window = 7 } = {}) {
  if (done) return 'done'
  const days = daysUntil(iso)
  if (days === null) return 'none'
  if (days < 0) return 'overdue'
  if (autopay) return 'muted'
  if (days <= window) return 'soon'
  return 'later'
}

/** First day of the month containing `iso`. */
export function startOfMonth(iso) {
  const date = parseISO(iso) || new Date()
  return toISO(new Date(date.getFullYear(), date.getMonth(), 1, 12))
}

export function endOfMonth(iso) {
  const date = parseISO(iso) || new Date()
  return toISO(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12))
}

export function monthLabel(iso) {
  const date = parseISO(iso) || new Date()
  return `${['January','February','March','April','May','June','July',
             'August','September','October','November','December'][date.getMonth()]} ${date.getFullYear()}`
}

/** The calendar quarter (1-4) that `iso` falls in. */
export function quarterOf(iso) {
  const date = parseISO(iso)
  return date ? Math.floor(date.getMonth() / 3) + 1 : null
}

/** Start and end of the quarter containing `iso`, inclusive. */
export function quarterRange(iso = todayISO()) {
  const date = parseISO(iso) || new Date()
  const firstMonth = Math.floor(date.getMonth() / 3) * 3
  return {
    start: toISO(new Date(date.getFullYear(), firstMonth, 1, 12)),
    end: toISO(new Date(date.getFullYear(), firstMonth + 3, 0, 12)),
  }
}

export function isBetween(iso, start, end) {
  if (!iso) return false
  const s = String(iso).slice(0, 10)
  return s >= String(start).slice(0, 10) && s <= String(end).slice(0, 10)
}

/**
 * Six weeks of dates covering the month containing `iso`, Sunday-first, for
 * the calendar grid.
 */
export function monthGrid(iso) {
  const first = parseISO(startOfMonth(iso))
  const gridStart = new Date(first)
  gridStart.setDate(1 - first.getDay())
  const weeks = []
  for (let w = 0; w < 6; w += 1) {
    const days = []
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(gridStart)
      day.setDate(gridStart.getDate() + w * 7 + d)
      days.push({
        iso: toISO(day),
        inMonth: day.getMonth() === first.getMonth(),
        isToday: toISO(day) === todayISO(),
      })
    }
    weeks.push(days)
  }
  return weeks
}
