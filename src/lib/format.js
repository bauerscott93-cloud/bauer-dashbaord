const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Money, always USD. Returns a dash for blank values so tables stay aligned. */
export function money(value, { blank = '—' } = {}) {
  if (value === null || value === undefined || value === '') return blank
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? usd.format(n) : blank
}

/** Money without the symbol, for inputs. */
export function moneyInput(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : ''
}

export function titleCase(str) {
  if (!str) return ''
  return str
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
