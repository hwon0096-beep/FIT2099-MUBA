import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BrowserProvider, type Eip1193Provider, type JsonRpcSigner } from 'ethers'
import { ThetanutsClient, MemoryStorageProvider } from '@thetanuts-finance/thetanuts-client'

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean
      on?: (event: string, listener: (...args: unknown[]) => void) => void
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
    }
  }
}

export const BASE_CHAIN_ID = 8453n
const BASE_CHAIN_ID_HEX = '0x2105'
const BASE_ADD_CHAIN_PARAMS = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
}

export type ConnectionState =
  | { status: 'no-wallet' }
  | { status: 'disconnected'; error?: string }
  | { status: 'connecting' }
  | { status: 'cancelled' }
  | { status: 'connected'; provider: BrowserProvider; signer: JsonRpcSigner; address: string }

export type ChainState =
  | { status: 'unknown' }
  | { status: 'wrong'; message?: string }
  | { status: 'switching' }
  | { status: 'correct' }

/**
 * ethers wraps a rejected wallet popup as `{ code: 'ACTION_REJECTED' }`, but the
 * SDK's write methods (ensureAllowance/fillOrder) re-wrap every non-SDK error into
 * a ContractRevertError via mapContractError. The original ethers error survives as
 * `.cause`, so a rejection has to be detected there too, not just on the top-level code.
 */
export function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code
  if (code === 'ACTION_REJECTED') return true
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined
  return (cause as { code?: unknown } | undefined)?.code === 'ACTION_REJECTED'
}

function getEip1193ErrorCode(error: unknown): number | undefined {
  const e = error as { code?: unknown; info?: { error?: { code?: unknown } }; error?: { code?: unknown } } | undefined
  const nested = e?.info?.error?.code ?? e?.error?.code
  if (typeof nested === 'number') return nested
  if (typeof e?.code === 'number') return e.code
  return undefined
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'An unknown error occurred.'
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

interface WalletContextValue {
  connection: ConnectionState
  chain: ChainState
  client: ThetanutsClient | null
  connectWallet: () => Promise<void>
  switchToBase: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<ConnectionState>(() => (
    typeof window !== 'undefined' && window.ethereum ? { status: 'disconnected' } : { status: 'no-wallet' }
  ))
  const [chain, setChain] = useState<ChainState>({ status: 'unknown' })
  const [client, setClient] = useState<ThetanutsClient | null>(null)

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) return
    setConnection({ status: 'connecting' })
    try {
      const provider = new BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setConnection({ status: 'connected', provider, signer, address })
    } catch (error) {
      if (isUserRejection(error)) {
        setConnection({ status: 'cancelled' })
        return
      }
      setConnection({ status: 'disconnected', error: error instanceof Error ? error.message : 'Could not connect to MetaMask.' })
    }
  }, [])

  // Check the connected chain, and keep watching for the user switching networks
  // from inside MetaMask itself (not just via our own "Switch to Base" button).
  useEffect(() => {
    if (connection.status !== 'connected') {
      setChain({ status: 'unknown' })
      return
    }
    let cancelled = false
    const recheck = async () => {
      try {
        const network = await connection.provider.getNetwork()
        if (cancelled) return
        setChain(network.chainId === BASE_CHAIN_ID ? { status: 'correct' } : { status: 'wrong' })
      } catch {
        if (!cancelled) setChain({ status: 'wrong' })
      }
    }
    void recheck()
    const onChainChanged = () => { void recheck() }
    window.ethereum?.on?.('chainChanged', onChainChanged)
    return () => {
      cancelled = true
      window.ethereum?.removeListener?.('chainChanged', onChainChanged)
    }
  }, [connection])

  const switchToBase = useCallback(async () => {
    if (connection.status !== 'connected') return
    setChain({ status: 'switching' })
    try {
      await connection.provider.send('wallet_switchEthereumChain', [{ chainId: BASE_CHAIN_ID_HEX }])
    } catch (error) {
      if (getEip1193ErrorCode(error) === 4902) {
        try {
          await connection.provider.send('wallet_addEthereumChain', [BASE_ADD_CHAIN_PARAMS])
          return
        } catch (addError) {
          setChain({ status: 'wrong', message: isUserRejection(addError) ? undefined : describeError(addError) })
          return
        }
      }
      setChain({ status: 'wrong', message: isUserRejection(error) ? undefined : describeError(error) })
    }
  }, [connection])

  // Instantiate the SDK client once we're connected on the right chain.
  useEffect(() => {
    if (connection.status !== 'connected' || chain.status !== 'correct') {
      setClient(null)
      return
    }
    // ThetanutsClient always builds an RFQKeyManagerModule internally, even though
    // this app only ever uses OptionBook (fetchOrders/previewFillOrder/fillOrder)
    // and read-only Portfolio lookups. Without an explicit keyStorageProvider it
    // throws InvalidKeyError in any browser context rather than defaulting to
    // plaintext localStorage. Nothing here ever calls client.rfqKeys, so an
    // in-memory provider is a no-op.
    setClient(new ThetanutsClient({
      chainId: 8453,
      provider: connection.provider,
      signer: connection.signer,
      keyStorageProvider: new MemoryStorageProvider(),
    }))
  }, [connection, chain])

  const value = useMemo(
    () => ({ connection, chain, client, connectWallet, switchToBase }),
    [connection, chain, client, connectWallet, switchToBase],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext)
  if (!value) throw new Error('useWallet() must be used inside a <WalletProvider>.')
  return value
}
