/** Parses order fields like strike/premium strings (which may carry a unit suffix, e.g. "1800/ETH") down to a plain number. */
export function parseOrderNumber(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, '').split('/')[0])
  return Number.isFinite(parsed) ? parsed : 0
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
    minimumFractionDigits: 2,
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
