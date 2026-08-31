import { ethers, type Provider } from 'ethers'

/**
 * @thetanuts-finance/thetanuts-client@0.3.0's client.events.getOrderFillEvents() maps each
 * OrderFilled log to { maker, taker, option, numContracts, price, referrer }. Verified directly
 * against real fills on Base mainnet: every one of those field names except `referrer` comes
 * back `undefined`. The SDK's internal ABI for the event (visible in its own OPTION_BOOK_ABI)
 * is actually:
 *
 *   OrderFilled(uint256 indexed nonce, address indexed buyer, address indexed seller,
 *     address optionAddress, uint256 premiumAmount, uint256 feeCollected, address referrer,
 *     uint256 referralFeePaid, bool sellerWasMaker)
 *
 * — so the log itself decodes correctly (client.events.getOrderFillEvents() does find real
 * events), but its post-decode field-mapping step still uses old field names that don't exist
 * on this event's args, silently producing `undefined` for maker/taker/option/numContracts/price
 * instead of throwing. This decodes the event ourselves with the real field names instead of
 * using that method at all.
 *
 * There's no `taker` field on the event — it has to be derived. `sellerWasMaker` says which side
 * posted the resting order (the maker); the other side is whoever called fillOrder() (the taker).
 */
const ORDER_FILLED_ABI = [
  'event OrderFilled(uint256 indexed nonce, address indexed buyer, address indexed seller, address optionAddress, uint256 premiumAmount, uint256 feeCollected, address referrer, uint256 referralFeePaid, bool sellerWasMaker)',
]

export interface TakerFill {
  optionAddress: string
  transactionHash: string
  blockNumber: number
  logIndex: number
  premiumAmount: bigint
  nonce: bigint
}

export interface FillSearchResult {
  fills: TakerFill[]
  /** Inclusive lower bound of the range actually searched — pass (this - 1) as `untilBlock` to search further back. */
  searchedFromBlock: number
  /** True once the search has reached the OptionBook's deployment block — nothing older can exist. */
  reachedDeploymentBlock: boolean
}

// Public RPC providers (including Base's own mainnet.base.org, used as the default here) commonly
// cap eth_getLogs at a 10,000-block range per call — confirmed directly against mainnet.base.org
// while investigating this (it rejects a wider range with "eth_getLogs is limited to a 10,000 range").
const BLOCK_RANGE_PER_CALL = 9999
// Matches the SDK's own default backward-search budget in queryFilterChunked() ("maxChunks = 10")
// for consistency, applied per fetchTakerFills() call so "search further back" pages in the same increments.
const DEFAULT_CHUNK_COUNT = 10

/**
 * Searches backward from `untilBlock` (inclusive) for OrderFilled events where `address` was the
 * taker, for up to `chunkCount` chunks of ~10,000 blocks each. Returns where the search stopped
 * so a caller can page further back by passing `searchedFromBlock - 1` as the next `untilBlock`.
 */
export async function fetchTakerFills(
  provider: Provider,
  optionBookAddress: string,
  address: string,
  untilBlock: number,
  deploymentBlock: number,
  chunkCount = DEFAULT_CHUNK_COUNT,
): Promise<FillSearchResult> {
  const iface = new ethers.Interface(ORDER_FILLED_ABI)
  const eventFragment = iface.getEvent('OrderFilled')
  if (!eventFragment) throw new Error('OrderFilled event fragment could not be built.')
  const topic = eventFragment.topicHash
  const addressTopic = ethers.zeroPadValue(ethers.getAddress(address), 32)

  const fills: TakerFill[] = []
  const seen = new Set<string>()
  let end = untilBlock
  let reachedDeploymentBlock = false

  for (let i = 0; i < chunkCount && end >= deploymentBlock; i++) {
    const start = Math.max(end - BLOCK_RANGE_PER_CALL, deploymentBlock)
    const [buyerLogs, sellerLogs] = await Promise.all([
      provider.getLogs({ address: optionBookAddress, topics: [topic, null, addressTopic], fromBlock: start, toBlock: end }),
      provider.getLogs({ address: optionBookAddress, topics: [topic, null, null, addressTopic], fromBlock: start, toBlock: end }),
    ])
    for (const log of [...buyerLogs, ...sellerLogs]) {
      const key = `${log.transactionHash}-${log.index}`
      if (seen.has(key)) continue
      seen.add(key)
      const parsed = iface.parseLog(log)
      if (!parsed) continue
      const { buyer, seller, optionAddress, premiumAmount, nonce, sellerWasMaker } = parsed.args as unknown as {
        buyer: string; seller: string; optionAddress: string; premiumAmount: bigint; nonce: bigint; sellerWasMaker: boolean
      }
      const taker = sellerWasMaker ? buyer : seller
      if (taker.toLowerCase() !== address.toLowerCase()) continue
      fills.push({ optionAddress, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.index, premiumAmount, nonce })
    }
    if (start === deploymentBlock) {
      reachedDeploymentBlock = true
      end = start - 1
      break
    }
    end = start - 1
  }

  fills.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
  return { fills, searchedFromBlock: end + 1, reachedDeploymentBlock }
}
