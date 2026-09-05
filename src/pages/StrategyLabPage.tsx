import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import StrategyAssistant from '../components/StrategyAssistant'
import { NutIcon } from '../components/VisualSystem'
import PremiumUnlockModal from '../components/PremiumUnlockModal'
import SavedStrategiesSection from '../components/SavedStrategiesSection'
import SimpleStrategyOverview, { OverviewHero } from '../components/SimpleStrategyOverview'
import CompareStrategies from '../components/CompareStrategies'
import PaperTradePreviewModal from '../components/PaperTradePreviewModal'
import { useAccount } from '../context/AccountContext'

import {
  daysToExpiry,
  formatCompactExpiry,
  formatNumber,
  parseOrderNumber,
  parseStrikeList,
} from '../lib/formatters'

import * as payoff from '../lib/payoff'

import {
  loadExplorerData,
  resolveAssetPrice,
  type ExplorerData,
  type ExplorerOrder,
} from '../lib/thetanuts'

import {
  defaultPaperContract,
  paperPositions,
  paperSummary,
  recentPaperTrades,
  type PaperContract,
  type PaperOptionSide,
} from '../data/paperTradingMockData'

import '../styles/strategy-lab.css'
import '../styles/strategy-lab-compact.css'


type StrategyLabTab =
  | 'overview'
  | 'paper-trading'
  | 'saved-strategies'
  | 'compare'


const STRATEGY_LAB_TABS: {
  value: StrategyLabTab
  icon: 'radar' | 'board' | 'contract' | 'trend'
  label: string
}[] = [
  { value: 'overview', icon: 'radar', label: 'Overview' },
  { value: 'paper-trading', icon: 'board', label: 'Paper Trading' },
  { value: 'saved-strategies', icon: 'contract', label: 'Saved Strategies' },
  { value: 'compare', icon: 'trend', label: 'Compare' },
]


type TypeFilter =
  | 'ALL'
  | 'CALL'
  | 'PUT'
  | 'Call Spread'
  | 'Put Spread'
  | 'Butterfly'
  | '4-leg structure'


interface ChainLeg {
  bid?: number
  ask?: number
}


interface ChainRow {
  strike: number
  expiry: string
  asset: string
  call: ChainLeg
  put: ChainLeg
}


const CHAIN_PAGE_SIZE = 25
const STARTING_VIRTUAL_BALANCE = 10000
const RECENT_TRADES_PREVIEW_COUNT = 5


interface OpenPaperPosition {
  id: string
  asset: string
  type: 'Call' | 'Put'
  strike: number
  expiryRaw: string
  entryDateMs: number
  quantity: number
  entryCost: number
  status: 'open' | 'closed'
}


interface RecentPaperTradeEntry {
  id: string
  label: string
  dateMs: number
  amount: number
  status: 'Opened' | 'Closed'
}


function orderAsset(order: ExplorerOrder): string {
  return order.asset.trim().toUpperCase() || 'UNKNOWN'
}


function isSpreadType(type: TypeFilter): boolean {
  return type !== 'ALL' && type !== 'CALL' && type !== 'PUT'
}


function isPremiumChainType(type: TypeFilter): boolean {
  return isSpreadType(type)
}


/**
 * Labels a multi-leg order and describes its legs.
 */
function describeSpread(
  order: ExplorerOrder
): {
  label: string
  legs: string
} {
  const strikes = parseStrikeList(order.strikes)

  if (strikes.length === 2) {
    const [near, far] = strikes

    const label =
      order.optionType === 'CALL'
        ? 'Call Spread'
        : order.optionType === 'PUT'
          ? 'Put Spread'
          : 'Spread'

    return {
      label,
      legs: `Buy $${near.toLocaleString()} / Sell $${far.toLocaleString()}`,
    }
  }

  if (strikes.length === 3) {
    const [low, mid, high] = strikes
      .slice()
      .sort((a, b) => a - b)

    return {
      label: 'Butterfly',
      legs:
        `Buy $${low.toLocaleString()} / ` +
        `Sell $${mid.toLocaleString()} x2 / ` +
        `Buy $${high.toLocaleString()}`,
    }
  }

  return {
    label: `${strikes.length}-leg structure`,
    legs: strikes
      .map((strike) => `$${strike.toLocaleString()}`)
      .join(' / '),
  }
}


export default function StrategyLabPage() {
  const { tier } = useAccount()

  const [selected, setSelected] =
    useState<PaperContract>(defaultPaperContract)

  const [selectedKey, setSelectedKey] =
    useState<string | null>(null)

  const [quantity, setQuantity] = useState(1)
  const [search, setSearch] = useState('')

  const [data, setData] =
    useState<ExplorerData | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [assetFilter, setAssetFilter] = useState('ALL')
  const [expiryFilter, setExpiryFilter] = useState('ALL')

  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>('ALL')

  const [tradeableOnly, setTradeableOnly] =
    useState(false)

  const [visibleCount, setVisibleCount] =
    useState(CHAIN_PAGE_SIZE)

  const [showUnlock, setShowUnlock] =
    useState(false)

  const [activeTab, setActiveTab] =
    useState<StrategyLabTab>('paper-trading')

  const [openPositions, setOpenPositions] =
    useState<OpenPaperPosition[]>([])

  const [recentTrades, setRecentTrades] =
    useState<RecentPaperTradeEntry[]>([])

  const [previewOpen, setPreviewOpen] =
    useState(false)

  const [justViewedPortfolio, setJustViewedPortfolio] =
    useState(false)

  const [showResetConfirm, setShowResetConfirm] =
    useState(false)

  const [showPortfolioModal, setShowPortfolioModal] =
    useState(false)

  const [showHowItWorks, setShowHowItWorks] =
    useState(false)


  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setData(await loadExplorerData())
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Live market data is unavailable.'
      )
    } finally {
      setLoading(false)
    }
  }, [])


  useEffect(() => {
    void refresh()
  }, [refresh])


  const orders = data?.orders ?? []


  const vanillaOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.optionType !== 'UNKNOWN' &&
          parseStrikeList(order.strikes).length === 1
      ),
    [orders]
  )


  const spreadOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          parseStrikeList(order.strikes).length >= 2
      ),
    [orders]
  )


  const isSpreadMode =
    isSpreadType(typeFilter)


  const vanillaAssets = useMemo(
    () =>
      [...new Set(vanillaOrders.map(orderAsset))].sort(),
    [vanillaOrders]
  )


  const spreadAssets = useMemo(
    () =>
      [...new Set(spreadOrders.map(orderAsset))].sort(),
    [spreadOrders]
  )


  const assets =
    isSpreadMode
      ? spreadAssets
      : vanillaAssets


  const vanillaExpiries = useMemo(
    () =>
      [...new Set(vanillaOrders.map((order) => order.expiry))]
        .sort((a, b) => Number(a) - Number(b)),
    [vanillaOrders]
  )


  const spreadExpiries = useMemo(
    () =>
      [...new Set(spreadOrders.map((order) => order.expiry))]
        .sort((a, b) => Number(a) - Number(b)),
    [spreadOrders]
  )


  const expiries =
    isSpreadMode
      ? spreadExpiries
      : vanillaExpiries


  useEffect(() => {
    if (
      assetFilter !== 'ALL' &&
      !assets.includes(assetFilter)
    ) {
      setAssetFilter('ALL')
    }
  }, [assets, assetFilter])


  useEffect(() => {
    if (
      expiryFilter !== 'ALL' &&
      !expiries.includes(expiryFilter)
    ) {
      setExpiryFilter('ALL')
    }
  }, [expiries, expiryFilter])


  useEffect(() => {
    if (!justViewedPortfolio) return

    const timer = setTimeout(
      () => setJustViewedPortfolio(false),
      1600
    )

    return () => clearTimeout(timer)
  }, [justViewedPortfolio])


  const chainOrders = useMemo(
    () =>
      vanillaOrders
        .filter(
          (order) =>
            assetFilter === 'ALL' ||
            orderAsset(order) === assetFilter
        )
        .filter(
          (order) =>
            expiryFilter === 'ALL' ||
            order.expiry === expiryFilter
        )
        .filter(
          (order) =>
            typeFilter === 'ALL' ||
            order.optionType === typeFilter
        ),
    [
      vanillaOrders,
      assetFilter,
      expiryFilter,
      typeFilter,
    ]
  )


  const chainRows = useMemo(() => {
    const byKey = new Map<string, ChainRow>()

    for (const order of chainOrders) {
      const strike =
        parseStrikeList(order.strikes)[0]

      if (strike === undefined) continue

      const key =
        `${strike}-${order.expiry}`

      let row =
        byKey.get(key)

      if (!row) {
        row = {
          strike,
          expiry: order.expiry,
          asset: orderAsset(order),
          call: {},
          put: {},
        }

        byKey.set(key, row)
      }

      const leg =
        order.optionType === 'PUT'
          ? row.put
          : row.call

      const price =
        parseOrderNumber(
          order.pricePerContract
        )

      if (order.side === 'BUY') {
        leg.bid =
          leg.bid === undefined
            ? price
            : Math.max(leg.bid, price)
      } else if (order.side === 'SELL') {
        leg.ask =
          leg.ask === undefined
            ? price
            : Math.min(leg.ask, price)
      }
    }

    return [...byKey.values()].sort(
      (a, b) =>
        a.strike - b.strike ||
        Number(a.expiry) - Number(b.expiry)
    )
  }, [chainOrders])


  const visibleRows = useMemo(
    () =>
      chainRows
        .filter((row) =>
          String(row.strike).includes(
            search
              .replaceAll(',', '')
              .trim()
          )
        )
        .filter(
          (row) =>
            !tradeableOnly ||
            row.call.ask !== undefined ||
            row.put.ask !== undefined
        ),
    [
      chainRows,
      search,
      tradeableOnly,
    ]
  )


  const spreadTableOrders = useMemo(
    () =>
      spreadOrders
        .filter(
          (order) =>
            assetFilter === 'ALL' ||
            orderAsset(order) === assetFilter
        )
        .filter(
          (order) =>
            expiryFilter === 'ALL' ||
            order.expiry === expiryFilter
        )
        .filter(
          (order) =>
            describeSpread(order).label ===
            typeFilter
        ),
    [
      spreadOrders,
      assetFilter,
      expiryFilter,
      typeFilter,
    ]
  )


  useEffect(() => {
    setVisibleCount(CHAIN_PAGE_SIZE)
  }, [
    assetFilter,
    expiryFilter,
    typeFilter,
    search,
    tradeableOnly,
  ])


  const pagedRows = useMemo(
    () =>
      visibleRows.slice(
        0,
        visibleCount
      ),
    [
      visibleRows,
      visibleCount,
    ]
  )


  const pagedSpreadTableOrders =
    useMemo(
      () =>
        spreadTableOrders.slice(
          0,
          visibleCount
        ),
      [
        spreadTableOrders,
        visibleCount,
      ]
    )


  const totalRows =
    isSpreadMode
      ? spreadTableOrders.length
      : visibleRows.length


  const selectContract = (
    row: ChainRow,
    side: PaperOptionSide
  ) => {
    const leg =
      side === 'call'
        ? row.call
        : row.put

    if (leg.ask === undefined) return

    setSelectedKey(
      `${row.strike}-${row.expiry}`
    )

    setSelected({
      asset: row.asset,

      type:
        side === 'call'
          ? 'Call'
          : 'Put',

      strike: row.strike,

      expiry:
        formatCompactExpiry(
          row.expiry
        ),

      expiryRaw: row.expiry,

      last: leg.ask,

      ask: leg.ask,
    })

    setPreviewOpen(true)
  }


  /*
   * Data passed into your StrategyAssistant.
   */
  const assistantOption =
    selectedKey
      ? {
          asset: selected.asset,
          type: selected.type,
          strike: selected.strike,
          expiry: selected.expiry,
          premium: selected.ask,

          currentPrice:
            resolveAssetPrice(
              selected.asset,
              data?.marketData?.prices
            ),
        }
      : undefined


  const virtualBalance =
    STARTING_VIRTUAL_BALANCE -
    openPositions.reduce(
      (sum, position) =>
        sum + position.entryCost,
      0
    )


  const confirmPaperBuy = () => {
    const entryCost =
      payoff.maxLossTotal(
        selected.ask,
        quantity
      )

    const id =
      `${selected.asset}-` +
      `${selected.expiryRaw}-` +
      `${selected.strike}-` +
      `${Date.now()}`

    setOpenPositions(
      (current) => [
        {
          id,
          asset: selected.asset,
          type: selected.type,
          strike: selected.strike,
          expiryRaw: selected.expiryRaw,
          entryDateMs: Date.now(),
          quantity,
          entryCost,
          status: 'open',
        },
        ...current,
      ]
    )

    setRecentTrades(
      (current) => [
        {
          id,

          label:
            `${selected.asset} ` +
            `${selected.type} ` +
            `$${selected.strike.toLocaleString()}`,

          dateMs: Date.now(),

          amount: -entryCost,

          status: 'Opened',
        },

        ...current,
      ]
    )
  }


  const closePosition = (
    id: string
  ) => {
    const position =
      openPositions.find(
        (existing) =>
          existing.id === id
      )

    setOpenPositions(
      (current) =>
        current.map(
          (existing) =>
            existing.id === id
              ? {
                  ...existing,
                  status:
                    'closed' as const,
                }
              : existing
        )
    )

    if (position) {
      setRecentTrades(
        (current) => [
          {
            id:
              `${id}-closed-` +
              `${Date.now()}`,

            label:
              `${position.asset} ` +
              `${position.type} ` +
              `$${position.strike.toLocaleString()}`,

            dateMs: Date.now(),

            amount: 0,

            status: 'Closed',
          },

          ...current,
        ]
      )
    }
  }


  const resetPaperAccount = () => {
    setOpenPositions([])
    setRecentTrades([])
    setShowResetConfirm(false)
  }


  const hasRealTrades =
    openPositions.length > 0


  const totalPaperPnl = 0


  const openPositionCount =
    openPositions.filter(
      (position) =>
        position.status === 'open'
    ).length


  const summaryItems =
    hasRealTrades
      ? [
          {
            label:
              'Virtual Balance',

            value:
              `${formatNumber(
                virtualBalance,
                2
              )} USDC`,

            detail:
              'Simulated account',
          },

          {
            label:
              'Total Paper P&L',

            value:
              `${formatNumber(
                totalPaperPnl,
                2
              )} USDC`,

            detail:
              'No live repricing yet',
          },

          {
            label:
              'Open Positions',

            value:
              String(
                openPositionCount
              ),

            detail:
              'Live',
          },
        ]

      : paperSummary.slice(0, 3)


  return (
    <main className="app-shell strategy-lab">

      <header
        className={
          `strategy-lab__hero${
            activeTab === 'overview'
              ? ' strategy-lab__hero--overview'
              : ''
          }`
        }
      >

        {activeTab === 'overview' && (
          <OverviewHero />
        )}

        <div className="strategy-lab__legacy-hero">

          <div className="strategy-lab__intro">

            <p className="eyebrow">
              STRATEGY LAB
            </p>

            <h1>
              Paper Trading
            </h1>

            <p>
              Practice trading real Thetanuts
              options with virtual funds before
              going live. Test strategies,
              compare scenarios, and build
              confidence.
            </p>

          </div>


          <div
            className="strategy-lab__art"
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </div>


          <section className="strategy-lab__safety">

            <NutIcon name="shield" />

            <div>

              <h2>
                No real funds at risk
              </h2>

              <p>
                All trades are simulated with
                virtual USDC using live
                Thetanuts market data. Nothing
                you do here affects your
                wallet.
              </p>

              <button
                type="button"
                className="text-action"
                onClick={() =>
                  setShowHowItWorks(true)
                }
              >
                Learn more →
              </button>

            </div>

          </section>

        </div>

      </header>


      <nav
        className="strategy-lab__tabs"
        aria-label="Strategy Lab sections"
      >

        {STRATEGY_LAB_TABS.map(
          ({
            value,
            icon,
            label,
          }) => (

            <button
              type="button"
              key={value}
              className={
                activeTab === value
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setActiveTab(value)
              }
            >

              <NutIcon name={icon} />

              {label}

            </button>
          )
        )}

      </nav>


      {activeTab === 'paper-trading' && (

        <div className="strategy-lab__workspace">

          <div className="strategy-lab__main">

            <section
              className="paper-summary"
              aria-label="Simulated account summary"
            >

              {summaryItems.map(
                (item, index) => (

                  <article
                    key={item.label}
                  >

                    <span className="summary-icon">
                      <NutIcon
                        name={
                          index === 0
                            ? 'wallet'
                            : index === 1
                              ? 'trend'
                              : 'contract'
                        }
                      />
                    </span>


                    <div>

                      <small>
                        {item.label}
                      </small>

                      <strong
                        className={
                          'tone' in item &&
                          item.tone ===
                            'positive'
                            ? 'pnl-positive'
                            : ''
                        }
                      >
                        {item.value}
                      </strong>

                      <em
                        className={
                          'tone' in item &&
                          item.tone ===
                            'positive'
                            ? 'pnl-positive'
                            : ''
                        }
                      >
                        {index === 2
                          ? 'positions'
                          : item.detail}
                      </em>


                      {index === 0 &&
                        hasRealTrades && (

                          <button
                            type="button"
                            className="text-action paper-summary__reset"
                            onClick={() =>
                              setShowResetConfirm(
                                true
                              )
                            }
                          >
                            Reset Paper Account
                          </button>

                        )}

                    </div>

                  </article>

                )
              )}

            </section>


            <OptionsChain
              rows={pagedRows}

              spreadRows={
                pagedSpreadTableOrders
              }

              totalRows={totalRows}

              assets={assets}

              expiries={expiries}

              assetFilter={assetFilter}

              expiryFilter={expiryFilter}

              typeFilter={typeFilter}

              search={search}

              tradeableOnly={
                tradeableOnly
              }

              selectedKey={
                selectedKey
              }

              loading={loading}

              error={error}

              premium={
                tier === 'premium'
              }

              onAsset={
                setAssetFilter
              }

              onExpiry={
                setExpiryFilter
              }

              onType={(next) => {
                if (
                  isPremiumChainType(
                    next
                  ) &&
                  tier !== 'premium'
                ) {
                  setShowUnlock(true)
                } else {
                  setTypeFilter(next)
                }
              }}

              onSearch={setSearch}

              onTradeableOnlyChange={
                setTradeableOnly
              }

              onSelect={
                selectContract
              }

              onLoadMore={() =>
                setVisibleCount(
                  (count) =>
                    count +
                    CHAIN_PAGE_SIZE
                )
              }
            />


            <OpenPaperPositions
              positions={
                openPositions
              }

              onClosePosition={
                closePosition
              }

              highlighted={
                justViewedPortfolio
              }
            />

          </div>


          <aside className="strategy-lab__side">

            <PaperOrderTicket
              contract={selected}

              canSimulate={
                selectedKey !== null
              }

              onSimulate={() =>
                setPreviewOpen(true)
              }
            />


            <RecentPaperTrades
              trades={recentTrades}

              onViewMore={() =>
                setShowPortfolioModal(
                  true
                )
              }
            />

          </aside>

        </div>
      )}


      {activeTab ===
        'saved-strategies' && (

        <SavedStrategiesSection
          orders={
            data
              ? orders
              : null
          }
        />

      )}


      {activeTab === 'overview' && (
        <SimpleStrategyOverview />
      )}


      {activeTab === 'compare' && (
        <CompareStrategies />
      )}


      {showUnlock && (
        <PremiumUnlockModal
          onClose={() =>
            setShowUnlock(false)
          }
        />
      )}


      <StrategyAssistant
        selectedOption={
          assistantOption
        }
      />


      {previewOpen && (

        <PaperTradePreviewModal
          contract={selected}

          quantity={quantity}

          onQuantityChange={
            setQuantity
          }

          virtualBalance={
            virtualBalance
          }

          onCancel={() =>
            setPreviewOpen(false)
          }

          onConfirm={
            confirmPaperBuy
          }

          onViewPortfolio={() => {

            document
              .getElementById(
                'open-paper-positions'
              )
              ?.scrollIntoView({
                behavior: 'smooth',
              })

            setJustViewedPortfolio(
              true
            )
          }}
        />

      )}


      {showResetConfirm && (

        <ResetPaperAccountModal
          onConfirm={
            resetPaperAccount
          }

          onCancel={() =>
            setShowResetConfirm(
              false
            )
          }
        />

      )}


      {showPortfolioModal && (

        <PaperPortfolioModal
          positions={
            openPositions
          }

          trades={
            recentTrades
          }

          onClosePosition={
            closePosition
          }

          onCancel={() =>
            setShowPortfolioModal(
              false
            )
          }
        />

      )}


      {showHowItWorks && (

        <HowPaperTradingWorksModal
          onCancel={() =>
            setShowHowItWorks(
              false
            )
          }
        />

      )}

    </main>
  )
}


function OptionsChain({
  rows,
  spreadRows,
  totalRows,
  assets,
  expiries,
  assetFilter,
  expiryFilter,
  typeFilter,
  search,
  tradeableOnly,
  selectedKey,
  loading,
  error,
  premium,
  onAsset,
  onExpiry,
  onType,
  onSearch,
  onTradeableOnlyChange,
  onSelect,
  onLoadMore,
}: {
  rows: ChainRow[]
  spreadRows: ExplorerOrder[]
  totalRows: number
  assets: string[]
  expiries: string[]
  assetFilter: string
  expiryFilter: string
  typeFilter: TypeFilter
  search: string
  tradeableOnly: boolean
  selectedKey: string | null
  loading: boolean
  error: string | null
  premium: boolean
  onAsset: (value: string) => void
  onExpiry: (value: string) => void
  onType: (value: TypeFilter) => void
  onSearch: (value: string) => void
  onTradeableOnlyChange: (value: boolean) => void
  onSelect: (
    row: ChainRow,
    side: PaperOptionSide
  ) => void
  onLoadMore: () => void
}) {

  const isSpreadMode =
    isSpreadType(typeFilter)


  const showExpiryHint =
    useMemo(
      () =>
        new Set(
          rows.map(
            (row) => row.expiry
          )
        ).size > 1,
      [rows]
    )


  const showCalls =
    !isSpreadMode &&
    typeFilter !== 'PUT'


  const showPuts =
    !isSpreadMode &&
    typeFilter !== 'CALL'


  const shownCount =
    isSpreadMode
      ? spreadRows.length
      : rows.length


  return (
    <section className="strategy-card strategy-card--chain">

      <div className="strategy-card__head">

        <div>
          <h2>
            Options Chain
          </h2>

          <p>
            Browse Thetanuts options
            and place simulated trades.
          </p>
        </div>

        <span className="demo-label">
          <i />
          Live data
        </span>

      </div>


      <div className="chain-filters">

        <label>
          Asset

          <select
            value={
              assetFilter
            }
            onChange={(event) =>
              onAsset(
                event.target.value
              )
            }
          >

            <option value="ALL">
              All assets
            </option>

            {assets.map(
              (asset) => (

                <option
                  key={asset}
                  value={asset}
                >
                  {asset}
                </option>

              )
            )}

          </select>
        </label>


        <label>
          Expiry

          <select
            value={
              expiryFilter
            }
            onChange={(event) =>
              onExpiry(
                event.target.value
              )
            }
          >

            <option value="ALL">
              All expiries
            </option>

            {expiries.map(
              (expiry) => (

                <option
                  key={expiry}
                  value={expiry}
                >
                  {formatCompactExpiry(
                    expiry
                  )}
                </option>

              )
            )}

          </select>

        </label>


        <label>
          Type

          <select
            value={
              typeFilter
            }
            onChange={(event) =>
              onType(
                event.target
                  .value as TypeFilter
              )
            }
          >

            <optgroup label="Option Type">

              <option value="ALL">
                All
              </option>

              <option value="CALL">
                Call
              </option>

              <option value="PUT">
                Put
              </option>

            </optgroup>


            <optgroup label="Strategies">

              <option value="Call Spread">
                {premium
                  ? 'Call Spread'
                  : '🔒 Call Spread'}
              </option>

              <option value="Put Spread">
                {premium
                  ? 'Put Spread'
                  : '🔒 Put Spread'}
              </option>

              <option value="Butterfly">
                {premium
                  ? 'Butterfly'
                  : '🔒 Butterfly'}
              </option>

              <option value="4-leg structure">
                {premium
                  ? '4-leg structure'
                  : '🔒 4-leg structure'}
              </option>

            </optgroup>

          </select>

        </label>


        {!isSpreadMode && (

          <label className="chain-filters__search">

            Search

            <input
              value={search}

              onChange={(event) =>
                onSearch(
                  event.target.value
                )
              }

              placeholder="Search strike or order ID..."
            />

          </label>

        )}


        {!isSpreadMode && (

          <label className="chain-filters__toggle">

            Tradeable only

            <span className="chain-filters__toggle-control">

              <input
                type="checkbox"

                checked={
                  tradeableOnly
                }

                onChange={(event) =>
                  onTradeableOnlyChange(
                    event.target
                      .checked
                  )
                }
              />

              <em>
                Hide rows with no quote
              </em>

            </span>

          </label>

        )}

      </div>


      <div className="strategy-table-wrap">

        {loading && !shownCount ? (

          <p>
            Loading live OptionBook
            orders…
          </p>

        ) : error ? (

          <p role="alert">
            Unable to load live options
            data: {error}
          </p>

        ) : !shownCount ? (

          <p>
            No live orders match the
            current filters.
          </p>

        ) : isSpreadMode ? (

          <table>

            <thead>

              <tr>
                <th>Asset</th>
                <th>Structure</th>
                <th>Expiry</th>
                <th>Legs</th>
                <th>
                  Combined Premium
                </th>
                <th>Side</th>
                <th>
                  Available Size
                </th>
              </tr>

            </thead>


            <tbody>

              {spreadRows.map(
                (order) => {

                  const {
                    label,
                    legs,
                  } =
                    describeSpread(
                      order
                    )

                  return (
                    <tr key={order.id}>

                      <td>
                        <strong>
                          {orderAsset(
                            order
                          )}
                        </strong>
                      </td>

                      <td>
                        {label}
                      </td>

                      <td>
                        {formatCompactExpiry(
                          order.expiry
                        )}
                      </td>

                      <td>
                        {legs}
                      </td>

                      <td>
                        {parseOrderNumber(
                          order.pricePerContract
                        ).toLocaleString()}{' '}

                        <small>
                          {
                            order.collateral
                          }
                        </small>
                      </td>

                      <td>
                        {order.side ===
                        'BUY'
                          ? 'Buy'
                          : order.side ===
                              'SELL'
                            ? 'Sell'
                            : '—'}
                      </td>

                      <td>
                        {
                          order.availableAmount
                        }
                      </td>

                    </tr>
                  )
                }
              )}

            </tbody>

          </table>

        ) : (

          <table className="options-chain-table">

            <thead>

              <tr>

                {showCalls && (
                  <th
                    colSpan={3}
                    className="call-heading"
                  >
                    Calls (Buy)
                  </th>
                )}

                <th rowSpan={2}>
                  Strike
                </th>

                {showPuts && (
                  <th
                    colSpan={3}
                    className="put-heading"
                  >
                    Puts (Buy)
                  </th>
                )}

              </tr>


              <tr>

                {showCalls && (
                  <>
                    <th>Bid</th>
                    <th>Ask</th>

                    <th
                      aria-label="Call action"
                    />
                  </>
                )}


                {showPuts && (
                  <>
                    <th>Bid</th>
                    <th>Ask</th>

                    <th
                      aria-label="Put action"
                    />
                  </>
                )}

              </tr>

            </thead>


            <tbody>

              {rows.map(
                (row) => {

                  const key =
                    `${row.strike}-${row.expiry}`

                  return (

                    <tr
                      key={key}

                      className={
                        key === selectedKey
                          ? 'selected'
                          : ''
                      }
                    >

                      {showCalls && (
                        <>

                          <td>
                            {row.call.bid !==
                            undefined
                              ? row.call.bid.toLocaleString()
                              : '—'}
                          </td>

                          <td>
                            {row.call.ask !==
                            undefined
                              ? row.call.ask.toLocaleString()
                              : '—'}
                          </td>

                          <td>

                            <button
                              type="button"

                              className="paper-buy paper-buy--call"

                              disabled={
                                row.call.ask ===
                                undefined
                              }

                              onClick={() =>
                                onSelect(
                                  row,
                                  'call'
                                )
                              }
                            >
                              Paper Buy
                            </button>

                          </td>

                        </>
                      )}


                      <td className="strike">

                        {row.strike.toLocaleString()}

                        {showExpiryHint && (
                          <small>
                            {formatCompactExpiry(
                              row.expiry
                            )}
                          </small>
                        )}

                      </td>


                      {showPuts && (
                        <>

                          <td>
                            {row.put.bid !==
                            undefined
                              ? row.put.bid.toLocaleString()
                              : '—'}
                          </td>

                          <td>
                            {row.put.ask !==
                            undefined
                              ? row.put.ask.toLocaleString()
                              : '—'}
                          </td>

                          <td>

                            <button
                              type="button"

                              className="paper-buy paper-buy--put"

                              disabled={
                                row.put.ask ===
                                undefined
                              }

                              onClick={() =>
                                onSelect(
                                  row,
                                  'put'
                                )
                              }
                            >
                              Paper Buy
                            </button>

                          </td>

                        </>
                      )}

                    </tr>

                  )
                }
              )}

            </tbody>

          </table>

        )}

      </div>


      {shownCount < totalRows && (

        <button
          type="button"

          className="text-action chain-load-more"

          onClick={
            onLoadMore
          }
        >
          Load more (
          {totalRows -
            shownCount}{' '}
          remaining)
        </button>

      )}

    </section>
  )
}


function PaperOrderTicket({
  contract,
  canSimulate,
  onSimulate,
}: {
  contract: PaperContract
  canSimulate: boolean
  onSimulate: () => void
}) {

  return (

    <aside className="strategy-card strategy-card--ticket">

      <div className="strategy-card__head">

        <h2>
          Last Selected{' '}
          <em>
            Simulated
          </em>
        </h2>

        <button
          type="button"
          className="text-action"
        >
          Clear
        </button>

      </div>


      <p className="ticket-disclaimer">
        This is the contract you
        previously selected. Use
        Simulate Trade to review and
        confirm it again.
      </p>


      <div className="ticket-contract">

        <strong>
          {contract.asset}{' '}
          ${contract.strike.toLocaleString()}{' '}
          {contract.type}
        </strong>

        <span
          className={
            `option-type ${
              contract.type === 'Call'
                ? 'call'
                : 'put'
            }`
          }
        >
          {contract.type}
        </span>

      </div>


      <button
        type="button"

        className="simulate-trade"

        disabled={
          !canSimulate
        }

        onClick={
          onSimulate
        }
      >
        Simulate Trade{' '}
        <NutIcon name="arrow" />
      </button>


      {!canSimulate && (

        <p className="ticket-disclaimer">
          Select a live option from the
          chain above (Paper Buy) to
          enable this.
        </p>

      )}


      <p className="ticket-disclaimer">
        This is a simulated paper trade
        using virtual USDC. No real
        funds will be spent.
      </p>

    </aside>

  )
}


function OpenPaperPositions({
  positions,
  onClosePosition,
  highlighted,
}: {
  positions: OpenPaperPosition[]
  onClosePosition: (id: string) => void
  highlighted: boolean
}) {

  const real =
    positions.length > 0


  const openOnly =
    positions.filter(
      (position) =>
        position.status === 'open'
    )


  const [expandedId, setExpandedId] =
    useState<string | null>(null)


  return (

    <section
      id="open-paper-positions"

      className={
        `strategy-card strategy-card--positions${
          highlighted
            ? ' just-viewed'
            : ''
        }`
      }
    >

      <div className="strategy-card__head">

        <h2>
          Open Paper Positions{' '}

          <small>
            (
            {real
              ? openOnly.length
              : paperPositions.length}
            )
          </small>

        </h2>


        <button
          type="button"
          className="text-action"
        >
          View all →
        </button>

      </div>


      <div className="strategy-table-wrap">

        <table>

          <thead>

            <tr>
              <th>Asset</th>
              <th>Strategy</th>
              <th>Entry Date</th>
              <th>Days to Expiry</th>
              <th>Entry Cost</th>
              <th>Current Value</th>
              <th>Paper P&amp;L</th>
              <th>Status</th>
              <th>Action</th>
            </tr>

          </thead>


          <tbody>

            {real
              ? openOnly.map(
                  (position) => {

                    const expanded =
                      expandedId ===
                      position.id

                    return (

                      <Fragment
                        key={
                          position.id
                        }
                      >

                        <tr>

                          <td>
                            <strong>
                              {
                                position.asset
                              }
                            </strong>
                          </td>


                          <td>

                            <strong>
                              {
                                position.asset
                              }{' '}
                              {
                                position.type
                              }{' '}
                              $
                              {position.strike.toLocaleString()}
                            </strong>

                            <small>
                              {formatCompactExpiry(
                                position.expiryRaw
                              )}{' '}
                              · $
                              {position.strike.toLocaleString()}{' '}
                              {
                                position.type
                              }
                            </small>

                          </td>


                          <td>
                            {new Date(
                              position.entryDateMs
                            ).toLocaleDateString(
                              'en-US',
                              {
                                month:
                                  'short',
                                day:
                                  'numeric',
                                year:
                                  'numeric',
                              }
                            )}
                          </td>


                          <td>
                            {daysToExpiry(
                              position.expiryRaw
                            )}
                          </td>


                          <td>
                            {formatNumber(
                              position.entryCost,
                              2
                            )}
                          </td>


                          <td>
                            {formatNumber(
                              position.entryCost,
                              2
                            )}
                          </td>


                          <td>
                            +0.00
                            <small>
                              0.00%
                            </small>
                          </td>


                          <td>
                            <span className="open-status">
                              Open
                            </span>
                          </td>


                          <td>

                            <button
                              type="button"

                              className="view-position"

                              onClick={() =>
                                setExpandedId(
                                  expanded
                                    ? null
                                    : position.id
                                )
                              }
                            >
                              {expanded
                                ? 'Hide Details'
                                : 'View Details'}
                            </button>

                          </td>

                        </tr>


                        {expanded && (

                          <tr className="position-detail-row">

                            <td colSpan={9}>

                              <PositionDetailFields
                                position={
                                  position
                                }

                                onClose={() =>
                                  onClosePosition(
                                    position.id
                                  )
                                }
                              />

                            </td>

                          </tr>

                        )}

                      </Fragment>

                    )
                  }
                )

              : paperPositions.map(
                  (position) => (

                    <tr
                      key={
                        position.strategy
                      }
                    >

                      <td>
                        <strong>
                          {
                            position.asset
                          }
                        </strong>
                      </td>

                      <td>

                        <strong>
                          {
                            position.strategy
                          }
                        </strong>

                        <small>
                          {
                            position.detail
                          }
                        </small>

                      </td>

                      <td>
                        {
                          position.entry
                        }
                      </td>

                      <td>
                        {
                          position.days
                        }
                      </td>

                      <td>
                        {
                          position.cost
                        }
                      </td>

                      <td>
                        {
                          position.value
                        }
                      </td>

                      <td
                        className={
                          position.positive
                            ? 'pnl-positive'
                            : 'pnl-negative'
                        }
                      >
                        {
                          position.pnl
                        }

                        <small>
                          {
                            position.change
                          }
                        </small>

                      </td>

                      <td>
                        <span className="open-status">
                          Open
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="view-position"
                        >
                          View
                        </button>
                      </td>

                    </tr>

                  )
                )}

          </tbody>

        </table>

      </div>

    </section>

  )
}


function PositionDetailFields({
  position,
  onClose,
}: {
  position: OpenPaperPosition
  onClose: () => void
}) {

  return (

    <div className="position-detail">

      <dl>

        <div>
          <dt>
            Asset
          </dt>
          <dd>
            {
              position.asset
            }
          </dd>
        </div>

        <div>
          <dt>
            Expiry
          </dt>
          <dd>
            {formatCompactExpiry(
              position.expiryRaw
            )}
          </dd>
        </div>

        <div>
          <dt>
            Strike
          </dt>
          <dd>
            $
            {position.strike.toLocaleString()}
          </dd>
        </div>

        <div>
          <dt>
            Quantity
          </dt>
          <dd>
            {
              position.quantity
            }
          </dd>
        </div>

      </dl>


      <dl>

        <div>
          <dt>
            Entry Premium
          </dt>

          <dd>
            {formatNumber(
              position.entryCost /
                position.quantity,
              2
            )}{' '}
            USDC
          </dd>
        </div>


        <div>
          <dt>
            Entry Cost
          </dt>

          <dd>
            {formatNumber(
              position.entryCost,
              2
            )}{' '}
            USDC
          </dd>
        </div>


        <div>
          <dt>
            Days to Expiry
          </dt>

          <dd>
            {daysToExpiry(
              position.expiryRaw
            )}
          </dd>
        </div>

      </dl>


      <p className="position-detail__note">
        ℹ P&amp;L tracking not yet
        available — there's no live
        repricing feed for open paper
        positions yet.
      </p>


      <div className="position-detail__actions">

        <button
          type="button"
          className="modal-cancel"
          onClick={
            onClose
          }
        >
          Close Position
        </button>

      </div>

    </div>

  )
}


function RecentPaperTrades({
  trades,
  onViewMore,
}: {
  trades: RecentPaperTradeEntry[]
  onViewMore: () => void
}) {

  if (trades.length === 0) {

    return (

      <section className="strategy-card">

        <div className="strategy-card__head">

          <h2>
            Recent Paper Trades
          </h2>

          <button
            type="button"
            className="text-action"
            disabled
            title="No trades yet"
          >
            View More Details
          </button>

        </div>


        {recentPaperTrades.map(
          (trade) => (

            <article
              className="recent-paper-trade"
              key={
                trade.strategy
              }
            >

              <div>
                <strong>
                  {
                    trade.strategy
                  }
                </strong>

                <small>
                  {
                    trade.date
                  }
                </small>
              </div>

              <span
                className={
                  trade.positive
                    ? 'pnl-positive'
                    : 'pnl-negative'
                }
              >
                {
                  trade.amount
                }
              </span>

              <em>
                {
                  trade.status
                }
              </em>

            </article>

          )
        )}

      </section>

    )
  }


  const visible =
    trades.slice(
      0,
      RECENT_TRADES_PREVIEW_COUNT
    )


  return (

    <section className="strategy-card">

      <div className="strategy-card__head">

        <h2>
          Recent Paper Trades
        </h2>

        <button
          type="button"
          className="text-action"
          onClick={
            onViewMore
          }
        >
          View More Details
        </button>

      </div>


      {visible.map(
        (trade) => (

          <article
            className="recent-paper-trade"
            key={
              trade.id
            }
          >

            <div>

              <strong>
                {
                  trade.label
                }
              </strong>

              <small>
                {new Date(
                  trade.dateMs
                ).toLocaleDateString(
                  'en-US',
                  {
                    month:
                      'short',
                    day:
                      'numeric',
                    year:
                      'numeric',
                  }
                )}
              </small>

            </div>


            <span
              className={
                trade.amount > 0
                  ? 'pnl-positive'
                  : trade.amount < 0
                    ? 'pnl-negative'
                    : ''
              }
            >
              {formatNumber(
                trade.amount,
                2
              )}
            </span>


            <em>
              {
                trade.status
              }
            </em>

          </article>

        )
      )}

    </section>

  )
}


function ResetPaperAccountModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {

  return (

    <div className="modal-backdrop">

      <section className="modal-panel">

        <h2>
          Reset Paper Account?
        </h2>

        <p className="modal-subtext">
          This will clear all your
          simulated positions and trade
          history, and reset your balance
          back to{' '}
          {STARTING_VIRTUAL_BALANCE.toLocaleString(
            'en-US'
          )}{' '}
          USDC. This can't be undone.
        </p>


        <div className="modal-footer">

          <button
            type="button"
            className="modal-cancel"
            onClick={
              onCancel
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="modal-primary"
            onClick={
              onConfirm
            }
          >
            Reset Account
          </button>

        </div>

      </section>

    </div>

  )
}


function HowPaperTradingWorksModal({
  onCancel,
}: {
  onCancel: () => void
}) {

  return (

    <div className="modal-backdrop">

      <section className="modal-panel">

        <header className="modal-header">

          <h2>
            How Paper Trading Works
          </h2>

          <button
            type="button"
            className="modal-close"
            onClick={
              onCancel
            }
            aria-label="Close"
          >
            ×
          </button>

        </header>


        <div className="strategy-card paper-info">

          <ul>

            <li>
              <strong>
                Starting balance
              </strong>

              Every paper account starts
              at{' '}
              {STARTING_VIRTUAL_BALANCE.toLocaleString(
                'en-US'
              )}{' '}
              USDC, simulated only — no
              real funds or wallet are
              involved at any point.
            </li>


            <li>

              <strong>
                Live prices, simulated
                trades
              </strong>

              Option prices and quotes in
              the chain come from live
              Thetanuts market data — the
              prices are real, the trades
              placed here are not.

            </li>


            <li>

              <strong>
                Closing a position
              </strong>

              Closing marks a position
              "closed" without crediting
              back a market-based exit
              value, since there's no
              live repricing feed for
              held positions yet. This
              is a known limitation, not
              a bug.

            </li>


            <li>

              <strong>
                Starting over
              </strong>

              Reset Paper Account
              restores the{' '}
              {STARTING_VIRTUAL_BALANCE.toLocaleString(
                'en-US'
              )}{' '}
              USDC starting balance and
              clears all simulated
              positions and trade
              history.

            </li>

          </ul>

        </div>


        <div className="modal-footer">

          <button
            type="button"
            className="modal-primary"
            onClick={
              onCancel
            }
          >
            Got it
          </button>

        </div>

      </section>

    </div>

  )
}


function PaperPortfolioModal({
  positions,
  trades,
  onClosePosition,
  onCancel,
}: {
  positions: OpenPaperPosition[]
  trades: RecentPaperTradeEntry[]
  onClosePosition: (id: string) => void
  onCancel: () => void
}) {

  const [tab, setTab] =
    useState<'open' | 'history'>(
      'open'
    )


  const openOnly =
    positions.filter(
      (position) =>
        position.status === 'open'
    )


  let runningBalance =
    STARTING_VIRTUAL_BALANCE


  const balanceAfterById =
    new Map(
      trades
        .slice()
        .reverse()
        .map((trade) => {

          runningBalance +=
            trade.amount

          return [
            trade.id,
            runningBalance,
          ] as const

        })
    )


  return (

    <div className="modal-backdrop">

      <section className="modal-panel paper-portfolio-modal">

        <header className="modal-header">

          <h2>
            Paper Portfolio
          </h2>

          <button
            type="button"
            className="modal-close"
            onClick={
              onCancel
            }
            aria-label="Close"
          >
            ×
          </button>

        </header>


        <p className="modal-subtext">
          Review your simulated
          positions and trade history.
          Figures that would need a live
          repricing feed (current mark,
          unrealized P&amp;L) aren't
          available yet, so they're left
          out rather than estimated.
        </p>


        <div className="paper-portfolio-modal__tabs">

          <button
            type="button"
            className={
              tab === 'open'
                ? 'active'
                : ''
            }
            onClick={() =>
              setTab('open')
            }
          >
            Open Positions (
            {openOnly.length})
          </button>


          <button
            type="button"
            className={
              tab === 'history'
                ? 'active'
                : ''
            }
            onClick={() =>
              setTab('history')
            }
          >
            Trade History (
            {trades.length})
          </button>

        </div>


        <div className="paper-portfolio-modal__body">

          {tab === 'open'

            ? openOnly.length === 0

              ? (

                <p className="paper-portfolio-modal__empty">
                  No open positions yet.
                </p>

              )

              : openOnly.map(
                  (position) => (

                    <article
                      key={
                        position.id
                      }
                      className="paper-portfolio-modal__card"
                    >

                      <header>

                        <strong>
                          {
                            position.asset
                          }{' '}
                          {
                            position.type
                          }
                        </strong>

                        <span className="open-status">
                          Open
                        </span>

                      </header>


                      <PositionDetailFields
                        position={
                          position
                        }

                        onClose={() =>
                          onClosePosition(
                            position.id
                          )
                        }
                      />

                    </article>

                  )
                )

            : trades.length === 0

              ? (

                <p className="paper-portfolio-modal__empty">
                  No trade history yet.
                </p>

              )

              : (

                <div className="strategy-table-wrap">

                  <table>

                    <thead>

                      <tr>
                        <th>
                          Trade
                        </th>

                        <th>
                          Date
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Balance After
                        </th>

                        <th>
                          Status
                        </th>
                      </tr>

                    </thead>


                    <tbody>

                      {trades.map(
                        (trade) => (

                          <tr
                            key={
                              trade.id
                            }
                          >

                            <td>
                              <strong>
                                {
                                  trade.label
                                }
                              </strong>
                            </td>


                            <td>
                              {new Date(
                                trade.dateMs
                              ).toLocaleDateString(
                                'en-US',
                                {
                                  month:
                                    'short',
                                  day:
                                    'numeric',
                                  year:
                                    'numeric',
                                }
                              )}
                            </td>


                            <td
                              className={
                                trade.amount >
                                0
                                  ? 'pnl-positive'
                                  : trade.amount <
                                      0
                                    ? 'pnl-negative'
                                    : ''
                              }
                            >
                              {formatNumber(
                                trade.amount,
                                2
                              )}
                            </td>


                            <td>
                              {formatNumber(
                                balanceAfterById.get(
                                  trade.id
                                ) ??
                                  STARTING_VIRTUAL_BALANCE,
                                2
                              )}{' '}
                              USDC
                            </td>


                            <td>
                              {
                                trade.status
                              }
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

        </div>

      </section>

    </div>

  )
}