# Thetanuts Options Explorer

A hackathon frontend for Thetanuts Finance V4 OptionBook on Base: it explores live orders and market data, analyzes payoff/risk for a selected order, and can execute a real trade against the OptionBook through the user's own connected wallet.

## Install and run

Use Node.js 18 or newer.

```bash
npm install
npm run dev
```

The single `npm run dev` command starts both services:

- React/Vite frontend at `http://127.0.0.1:5173`
- Express API server at `http://127.0.0.1:8787`

Open the frontend URL in a browser. During local development, Vite proxies `/api/thetanuts` to the Express server, so the browser makes only same-origin requests and never calls Thetanuts services directly.

For a production verification build:

```bash
npm run build
```

Run the test suite with:

```bash
npm test
```

### Optional Base RPC

The explorer defaults to Base's public RPC (`https://mainnet.base.org`), which throttles aggressively under real load. For a more reliable demo, set `BASE_RPC_URL` in a `.env` file to your own Base mainnet RPC endpoint (e.g. from Alchemy or Infura).

`BASE_RPC_URL` is read server-side only, by `server/thetanuts.ts` via plain `process.env` — it is **not** a `VITE_`-prefixed variable and is never bundled into the browser. It also accepts a comma-separated list (primary RPC first, then fallback(s)); if a request against the primary fails, the server retries once against the next URL before giving up on that source.

## Thetanuts integration

The browser fetch wrapper is in [`src/lib/thetanuts.ts`](src/lib/thetanuts.ts). It only calls `GET /api/thetanuts`.

The server-only, read-only SDK integration is in [`server/thetanuts.ts`](server/thetanuts.ts). It creates a read-only SDK client (no signer) using:

```ts
new ThetanutsClient({ chainId: 8453, provider })
```

and loads real data with:

- `client.api.fetchOrders()`
- `client.api.getMarketData()`
- `client.api.getBookProtocolStats()`

Each server-side source has a 12-second timeout and is logged separately. If a live API/indexer source cannot be reached, the app shows its technical error and does not replace that source with mock data.

## Trade execution

The app also includes a live, non-custodial trade execution flow — this is real, not a mock:

- **Wallet connection** ([`src/lib/WalletContext.tsx`](src/lib/WalletContext.tsx)): connects to the browser's injected wallet (e.g. MetaMask) via `eth_requestAccounts`, checks/switches the connected chain to Base, and builds a signer-backed `ThetanutsClient` only once the wallet is connected and on the correct chain. The app never receives, stores, or transmits a private key — every signature (approval, fill) is requested from the wallet extension itself.
- **Pre-flight validation** ([`src/lib/tradePreflight.ts`](src/lib/tradePreflight.ts)): before any approval or fill, the entered amount and the selected order are validated together — wallet connected, correct network, order not expired, requested amount within the order's live availability, and a successful `previewFillOrder` simulation — before a spend approval or transaction is ever requested from the wallet.
- **Fill flow** ([`src/FillFlow.tsx`](src/FillFlow.tsx)): re-validates the order and preview immediately before requesting the ERC-20 approval and again immediately before calling `fillOrder`, since either step can be delayed by the user's own wallet-confirmation time.

The UI is in [`src/OptionsExplorer.tsx`](src/OptionsExplorer.tsx) (Markets), [`src/pages/AnalyzePage.tsx`](src/pages/AnalyzePage.tsx) (payoff/risk analysis), [`src/FillFlow.tsx`](src/FillFlow.tsx) (Trade), and [`src/pages/PortfolioPage.tsx`](src/pages/PortfolioPage.tsx) (on-chain position history, read directly from `OrderFilled` events and the Thetanuts indexer — no local database).

## Payoff math and premium denomination

Payoff, break-even, and scenario math for vanilla calls/puts and two-leg vertical debit spreads live in [`src/lib/payoff.ts`](src/lib/payoff.ts) and [`src/lib/spreadPayoff.ts`](src/lib/spreadPayoff.ts) — pure functions shared by Analyze, Trade, and Discover, with unit tests in their respective `*.test.ts` files.

An order's premium is quoted in its collateral token, which is not always USDC (e.g. a WETH- or cbBTC-collateralized order quotes its premium in that asset, not USD). [`src/lib/orderPayoff.ts`](src/lib/orderPayoff.ts)'s `isPremiumUsdSafe()` gates every USD payoff/break-even display on the order's collateral actually being USDC; a non-USDC premium is shown in its native denomination instead of being silently treated as a 1:1 USD amount.

## Deployment

[`render.yaml`](render.yaml) and [`start.ts`](start.ts) configure a single-process production deployment (Render, free plan): `npm run build` builds the frontend into `dist/`, and `npm start` serves that build and the API from one Express process. `BASE_RPC_URL` must be set as an environment variable on the deployment target — it is not committed.

## Remaining work

- Add reliable production RPC/indexer monitoring beyond the existing timeout/retry/fallback handling.
- Extend payoff/break-even display to non-USDC-denominated and 3+ strike (butterfly/condor) orders, currently shown with their native values only.
- Broaden Portfolio beyond entry/status data (e.g. surfacing the indexer's own settlement/P&L fields once verified against real settled positions).
