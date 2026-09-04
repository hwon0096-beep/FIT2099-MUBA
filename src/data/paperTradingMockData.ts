export type OptionSide = 'call' | 'put'

export interface PaperOptionRow {
  strike: number
  call: { bid: number; ask: number; last: number }
  put: { bid: number; ask: number; last: number }
}

export interface PaperContract {
  asset: string
  type: 'Call' | 'Put'
  strike: number
  expiry: string
  last: number
  ask: number
}

interface PaperSummaryItem {
  label: string
  value: string
  detail: string
  tone?: 'positive'
}

export const paperSummary: PaperSummaryItem[] = [
  { label: 'Virtual Balance', value: '10,000 USDC', detail: 'Simulated account' },
  { label: 'Total Paper P&L', value: '+322 USDC', detail: '+3.22%', tone: 'positive' },
  { label: 'Open Positions', value: '3', detail: 'Paper positions' },
  { label: 'Win Rate', value: '67%', detail: 'Demo statistic' },
]

export const optionRows: PaperOptionRow[] = [
  { strike: 78000, call: { bid: 1520, ask: 1580, last: 1550 }, put: { bid: 180, ask: 210, last: 195 } },
  { strike: 79000, call: { bid: 1180, ask: 1240, last: 1210 }, put: { bid: 290, ask: 330, last: 310 } },
  { strike: 80000, call: { bid: 850, ask: 910, last: 880 }, put: { bid: 480, ask: 530, last: 505 } },
  { strike: 81000, call: { bid: 590, ask: 640, last: 615 }, put: { bid: 720, ask: 780, last: 750 } },
  { strike: 82000, call: { bid: 370, ask: 420, last: 395 }, put: { bid: 1050, ask: 1130, last: 1090 } },
  { strike: 83000, call: { bid: 210, ask: 250, last: 230 }, put: { bid: 1480, ask: 1580, last: 1520 } },
]

export const defaultPaperContract: PaperContract = { asset: 'BTC', type: 'Call', strike: 81000, expiry: 'Sep 11', last: 615, ask: 640 }

export const paperPositions = [
  { asset: 'ETH', strategy: 'ETH Long Call', detail: 'Jun 13, 2025 · $3,200 Call', entry: 'Jun 3, 2025', days: '10', cost: '112.00', value: '124.45', pnl: '+12.45', percent: '+11.12%', tone: 'positive' },
  { asset: 'ETH', strategy: 'ETH Bull Call Spread', detail: 'Jun 13, 2025 · $3,200 / $3,600', entry: 'Jun 3, 2025', days: '10', cost: '136.00', value: '148.32', pnl: '+12.32', percent: '+9.06%', tone: 'positive' },
  { asset: 'BTC', strategy: 'BTC Protective Put', detail: 'Jun 20, 2025 · $95,000 Put', entry: 'Jun 1, 2025', days: '17', cost: '98.00', value: '89.20', pnl: '-8.80', percent: '-8.98%', tone: 'negative' },
] as const

export const recentPaperTrades = [
  { strategy: 'ETH Bull Call Spread', date: 'Jun 3, 2025', amount: '-136.00', status: 'Opened', tone: 'negative' },
  { strategy: 'ETH Long Call', date: 'Jun 3, 2025', amount: '-112.00', status: 'Opened', tone: 'positive' },
  { strategy: 'BTC Protective Put', date: 'Jun 1, 2025', amount: '-98.00', status: 'Opened', tone: 'negative' },
  { strategy: 'SOL Long Call', date: 'May 28, 2025', amount: '+67.20', status: 'Closed', tone: 'positive' },
] as const
