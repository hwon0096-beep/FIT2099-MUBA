export function formatUsd(value: number | string | undefined, maximumFractionDigits = 2) {
  if (value === undefined) return 'Unavailable'
  const numericValue = typeof value === 'string' ? Number(value) : value

  if (!Number.isFinite(numericValue)) return 'Unavailable'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(numericValue)
}

export function formatExpiry(timestamp: bigint | string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(Number(timestamp) * 1000))
}

export function formatTimestamp(timestamp: number | undefined) {
  if (!timestamp) return 'Unavailable'

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
