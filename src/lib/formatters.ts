/** Parses order fields like strike/premium strings (which may carry a unit suffix, e.g. "1800/ETH") down to a plain number, taking the first '/'-separated segment. */
export function parseOrderNumber(value: string): number {
  const [firstSegment] = value.split('/')
  const parsed = Number(firstSegment.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Orders can carry more than one strike (e.g. "$2400 / $2450" for spread-style structures — see
 * server/thetanuts.ts's `strikes.map(...).join(' / ')`). Returns every numeric strike found, so
 * callers can tell a plain single-strike vanilla option apart from a multi-leg structure.
 */
export function parseStrikeList(value: string): number[] {
  return value.split('/')
    .map((segment) => segment.replace(/[^0-9.-]/g, ''))
    .filter((segment) => segment.length > 0)
    .map(Number)
    .filter((parsed) => Number.isFinite(parsed))
}

export function formatNumber(value: number | string | undefined, maximumFractionDigits = 2): string {
  if (value === undefined) return 'Unavailable'
  const numericValue = typeof value === 'string' ? Number(value) : value

  if (!Number.isFinite(numericValue)) return 'Unavailable'

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(numericValue)
}

export function formatUsd(value: number | string | undefined, maximumFractionDigits = 2): string {
  if (value === undefined) return 'Unavailable'
  const numericValue = typeof value === 'string' ? Number(value) : value

  if (!Number.isFinite(numericValue)) return 'Unavailable'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  }).format(numericValue)
}

export function formatExpiry(timestamp: bigint | string): string {
  const date = new Date(Number(timestamp) * 1000)
  if (Number.isNaN(date.getTime())) return 'Unavailable'

  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date)} UTC`
}

/** Compact UTC expiry for space-constrained order tables. */
export function formatCompactExpiry(timestamp: bigint | string): string {
  const date = new Date(Number(timestamp) * 1000)
  if (Number.isNaN(date.getTime())) return 'Unavailable'

  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'UTC',
  }).format(date).replace(',', ' ·')} UTC`
}

export function formatTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) return 'Unavailable'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Unavailable'

  return `${new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date)} UTC`
}
