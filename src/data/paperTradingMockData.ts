export type PaperOptionSide = 'call' | 'put'

export interface PaperContract {
  asset: string
  type: 'Call' | 'Put'
  strike: number
  expiry: string
  last: number
  ask: number
}

export const paperSummary = [
  { label: 'Virtual Balance', value: '10,000 USDC', detail: 'Simulated account' },
  { label: 'Total Paper P&L', value: '+322 USDC', detail: '+3.22%', tone: 'positive' },
  { label: 'Open Positions', value: '3', detail: 'Mock positions' },
  { label: 'Win Rate', value: '67%', detail: 'Demo statistic' },
] as const

export const optionChainRows = [
  { strike: 78000, call: [1520, 1580, 1550], put: [180, 210, 195] },
  { strike: 79000, call: [1180, 1240, 1210], put: [290, 330, 310] },
  { strike: 80000, call: [850, 910, 880], put: [480, 530, 505] },
  { strike: 81000, call: [590, 640, 615], put: [720, 780, 750] },
  { strike: 82000, call: [370, 420, 395], put: [1050, 1130, 1090] },
  { strike: 83000, call: [210, 250, 230], put: [1480, 1580, 1520] },
] as const

export const defaultPaperContract: PaperContract = { asset: 'BTC', type: 'Call', strike: 81000, expiry: 'Sep 11', last: 615, ask: 640 }

export const paperPositions = [
  { asset: 'ETH', strategy: 'ETH Long Call', detail: 'Jun 13, 2025 · $3,200 Call', entry: 'Jun 3, 2025', days: '10', cost: '112.00', value: '124.45', pnl: '+12.45', change: '+11.12%', positive: true },
  { asset: 'ETH', strategy: 'ETH Bull Call Spread', detail: 'Jun 13, 2025 · $3,200 / $3,600', entry: 'Jun 3, 2025', days: '10', cost: '136.00', value: '148.32', pnl: '+12.32', change: '+9.06%', positive: true },
  { asset: 'BTC', strategy: 'BTC Protective Put', detail: 'Jun 20, 2025 · $95,000 Put', entry: 'Jun 1, 2025', days: '17', cost: '98.00', value: '89.20', pnl: '-8.80', change: '-8.98%', positive: false },
] as const

export const recentPaperTrades = [
  { strategy: 'ETH Bull Call Spread', date: 'Jun 3, 2025', amount: '-136.00', status: 'Opened', positive: false },
  { strategy: 'ETH Long Call', date: 'Jun 3, 2025', amount: '-112.00', status: 'Opened', positive: true },
  { strategy: 'BTC Protective Put', date: 'Jun 1, 2025', amount: '-98.00', status: 'Opened', positive: false },
  { strategy: 'SOL Long Call', date: 'May 28, 2025', amount: '+67.20', status: 'Closed', positive: true },
] as const
