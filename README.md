# Thetanuts Options Explorer

A minimal, read-only hackathon frontend that proves a web application can consume live Thetanuts Finance V4 OptionBook data on Base.

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

### Optional Base RPC

The explorer defaults to Base's public RPC. For a more reliable demo, copy `.env.example` to `.env` and set `VITE_BASE_RPC_URL` to your Base mainnet RPC endpoint.

## Thetanuts integration

The browser fetch wrapper is in [`src/lib/thetanuts.ts`](src/lib/thetanuts.ts). It only calls `GET /api/thetanuts`.

The server-only SDK integration is in [`server/thetanuts.ts`](server/thetanuts.ts). It creates an SDK client using:

```ts
new ThetanutsClient({ chainId: 8453, provider })
```

There is deliberately no signer, wallet connection, approval, private key, or transaction call. The server loads real data with:

- `client.api.fetchOrders()`
- `client.api.getMarketData()`
- `client.api.getBookProtocolStats()`

Each server-side source has a 12-second timeout and is logged separately. The UI is in `src/OptionsExplorer.tsx`; it shows live OptionBook orders and market/protocol metrics. If a live API/indexer source cannot be reached, the app shows its technical error and does not replace that source with mock data.

## Remaining work

- Add selected-order details.
- Add reliable production RPC/indexer monitoring and retry policy.
- Design and security-review a wallet/trading flow only when the team is ready to support transactions.
- Add tests and deploy the static frontend.

This project is not a trading interface and cannot move funds.
