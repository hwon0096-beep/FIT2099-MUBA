# NUTSCOPE — Thetanuts Options Explorer

NUTSCOPE is a crypto options discovery, analysis, paper-trading, and execution platform built on top of Thetanuts Finance V4 OptionBook on Base.

The platform is designed to make on-chain options easier to explore and understand. Users can discover live options opportunities, browse the Thetanuts OptionBook, analyze payoff and risk, experiment with strategies using virtual funds, and proceed to real non-custodial trading through their own wallet.

---

## Project Description

Crypto options can be difficult for newer users to understand because they involve concepts such as calls, puts, strike prices, premiums, expiry dates, break-even prices, payoff profiles, and multi-leg strategies.

NUTSCOPE provides a more approachable interface on top of the live Thetanuts OptionBook.

The main workflow is:

**Discover → Explore Markets → Analyze → Practice → Trade**

### Discover

The Discover dashboard provides an overview of the live options market, including:

- Live crypto spot prices
- Current OptionBook orders
- Protocol volume
- Open interest
- Nearest expiry
- Strategy opportunities generated from available live orders

Instead of requiring users to manually search through hundreds of contracts, NUTSCOPE surfaces relevant opportunities such as bullish Long Calls and bearish Long Puts.

### Markets

The Markets page provides more detailed access to live Thetanuts OptionBook orders.

Users can filter opportunities by:

- Market outlook
- Asset
- Call / Put / Spread
- Expiry
- Premium
- Available size

Suggested Live Opportunities help narrow the live order book based on the user's selected filters.

### Analyze

Users can select an option and inspect its payoff and risk before trading.

Analysis includes supported metrics such as:

- Break-even price
- Maximum loss
- Maximum profit
- Scenario P&L
- Option payoff
- Moneyness
- Days to expiry

The analysis layer currently supports vanilla Calls/Puts and verified two-leg vertical debit spreads where sufficient order information is available.

### Strategy Lab

Strategy Lab provides a risk-free environment for learning and experimenting with options.

Users receive virtual USDC and can paper trade against market information without spending real funds.

It includes:

- Paper Trading
- Saved Strategies
- Strategy comparison
- Educational strategy information
- Free and Premium strategy access

Free users can access basic Call and Put functionality, while the prototype Premium tier exposes additional advanced strategy functionality.

### Trade

When users are ready to move from simulation to real trading, NUTSCOPE provides a non-custodial trade flow.

The user's wallet remains responsible for approvals and transaction signatures. NUTSCOPE never receives or stores the user's private key.

---

## Problem Statement

On-chain options protocols provide powerful financial infrastructure, but interacting with an options order book can be difficult for users who do not already understand derivatives.

A user may be presented with hundreds of contracts containing different strikes, expiries, premiums, collateral assets, and structures without an obvious way to determine:

- Which contracts are relevant to their market view
- How much they could lose
- When the position becomes profitable
- How the payoff changes when the underlying asset moves
- Whether they should experiment with a strategy before committing real funds

NUTSCOPE addresses this by adding a user-focused discovery and analysis layer on top of Thetanuts.

Instead of treating the OptionBook as only an execution venue, NUTSCOPE creates a workflow where users can:

**find → understand → simulate → execute**

Thetanuts remains load-bearing to the product because the live OptionBook provides the actual options market that NUTSCOPE discovers, analyzes, and trades against.

---

## Blockchain Technology Used

NUTSCOPE integrates with **Thetanuts Finance V4 OptionBook** and operates on **Base**.

### Network

- Blockchain: Base
- Chain ID: `8453`
- Environment: Base Mainnet
- Options protocol: Thetanuts Finance V4 OptionBook
- Wallet: Browser-injected Ethereum wallet such as MetaMask
- SDK: `@thetanuts-finance/thetanuts-client`

The server creates a read-only Thetanuts SDK client using:

```ts
new ThetanutsClient({
  chainId: 8453,
  provider
})
```

Live data is retrieved using Thetanuts SDK functionality including:

```ts
client.api.fetchOrders()
client.api.getMarketData()
client.api.getBookProtocolStats()
```

The frontend never needs access to a user's private key.

For real trades, signing and approvals occur through the user's connected wallet.

---

## Smart Contract Addresses

### Network used by this project

NUTSCOPE currently integrates with **Thetanuts on Base Mainnet (Chain ID 8453)**.

The current implementation does **not use a testnet deployment**, so there are no project testnet contract addresses to report.

Thetanuts contract/order information used by the application is obtained through the Thetanuts SDK and live OptionBook data rather than hard-coding a separate testnet deployment into the frontend.

> **Hackathon note:** The project interacts with existing Thetanuts infrastructure and does not deploy a custom NUTSCOPE smart contract.

If the submission form specifically requires Thetanuts contract addresses, they should be copied from the official Thetanuts deployment information/SDK configuration rather than guessed or replaced with unrelated testnet addresses.

---

## Thetanuts Integration

The browser-side wrapper is located at:

```text
src/lib/thetanuts.ts
```

It communicates with:

```text
GET /api/thetanuts
```

The server-side read-only SDK integration is located at:

```text
server/thetanuts.ts
```

The server communicates with Thetanuts services and returns normalized market/order data to the frontend.

Each server-side source has a timeout and is logged separately. If a live source cannot be reached, the application reports the error rather than silently replacing that source with fake market data.

---

## Trade Execution

NUTSCOPE includes a live, non-custodial trade execution flow.

### Wallet Connection

Implemented in:

```text
src/lib/WalletContext.tsx
```

The wallet flow:

1. Detects an injected wallet such as MetaMask.
2. Requests wallet connection.
3. Checks the connected network.
4. Switches/checks Base when required.
5. Creates a signer-backed Thetanuts client only after the wallet is correctly connected.

NUTSCOPE never receives, stores, or transmits the user's private key.

### Pre-flight Validation

Implemented in:

```text
src/lib/tradePreflight.ts
```

Before execution, the application checks supported conditions including:

- Wallet connected
- Correct network
- Order still exists
- Order has not expired
- Valid requested amount
- Sufficient order availability
- Successful `previewFillOrder`

### Fill Flow

Implemented in:

```text
src/FillFlow.tsx
```

The selected order is revalidated before approval/fill because market conditions can change while a user is confirming a wallet transaction.

---

## Payoff and Risk Analysis

Core payoff calculations are implemented as pure functions in:

```text
src/lib/payoff.ts
src/lib/spreadPayoff.ts
src/lib/orderPayoff.ts
```

The supported analysis includes vanilla Calls/Puts and verified two-leg vertical debit spreads.

The calculations are reused throughout the application where appropriate rather than implementing separate formulas for each screen.

### Premium denomination

An option premium is denominated in its collateral token and should not automatically be interpreted as USD.

`isPremiumUsdSafe()` in:

```text
src/lib/orderPayoff.ts
```

prevents non-USDC collateral premiums from being silently treated as USD.

---

## Setup and Installation

### Requirements

Install:

- Node.js 18 or newer
- npm
- A modern browser
- MetaMask or another supported injected wallet for real trading

Clone the repository and install dependencies:

```bash
npm install
```

Start the application:

```bash
npm run dev
```

This starts both services:

```text
Frontend: http://127.0.0.1:5173
API:      http://127.0.0.1:8787
```

Open the frontend URL in your browser.

During development, Vite proxies `/api/thetanuts` requests to the Express server.

### Production Build

```bash
npm run build
```

### Tests

```bash
npm test
```

---

## Environment Variables

Create a `.env` file in the project root when optional server configuration is required.

Example:

```env
BASE_RPC_URL=
PREMIUM_PASSWORD=
GEMINI_API_KEY=
```

Never commit real API keys or passwords.

Do not expose server secrets using `VITE_` variables.

### Base RPC

`BASE_RPC_URL` can optionally provide a more reliable Base RPC endpoint.

Without one, the application can use its configured public Base RPC fallback, subject to public RPC rate limits and availability.

The value is read server-side through:

```ts
process.env.BASE_RPC_URL
```

### Premium Demo Access

For hackathon demonstration purposes, the prototype includes Premium access.

Demo password:

```text
NUTSCOPE2026
```

A server-side `PREMIUM_PASSWORD` can override the demo value.

This is a prototype access mechanism only. Production authentication, payments, and subscriptions are outside the hackathon scope.

### AI

If the AI Analyst integration is enabled, its server-side provider requires:

```env
GEMINI_API_KEY=
```

If the key is unavailable, the rest of NUTSCOPE continues to operate.

---

## Project Structure

Important application files include:

```text
src/
├── pages/
│   ├── AnalyzePage.tsx
│   ├── PortfolioPage.tsx
│   └── StrategyLabPage.tsx
│
├── lib/
│   ├── WalletContext.tsx
│   ├── thetanuts.ts
│   ├── payoff.ts
│   ├── spreadPayoff.ts
│   ├── orderPayoff.ts
│   └── tradePreflight.ts
│
├── FillFlow.tsx
└── OptionsExplorer.tsx

server/
├── thetanuts.ts
└── ...
```

Main user-facing areas:

- **Discover** — market overview and live strategy opportunities
- **Markets** — searchable/filterable live OptionBook
- **Analyze** — payoff and risk analysis
- **Strategy Lab** — education and paper trading
- **Trade** — wallet-based live execution
- **Portfolio** — position/activity information

---

## Deployment

`render.yaml` and `start.ts` configure the production deployment.

The production process:

```text
npm run build
        ↓
Frontend compiled to dist/
        ↓
Express serves frontend + API
```

Production secrets such as RPC endpoints and API keys must be configured through the deployment environment and must not be committed to Git.

## Render link
https://fit2099-muba.onrender.com/

---

## Team Members

> Replace the placeholders below with the final names and responsibilities of each team member.

| Team Member |
| Angeline Regina Lee 
| Hui Qing Wong |
| See Eng Chin | 

---

## Safety

The project includes both simulation and real blockchain functionality.

### Strategy Lab

Strategy Lab uses virtual funds.

No real USDC is spent through paper trading.

### Live Trading

Live OptionBook execution can involve real funds on Base Mainnet.

Users should:

- Verify the selected order before signing.
- Verify the Base network.
- Review token approvals.
- Use small amounts when testing.
- Never share a private key or seed phrase.

NUTSCOPE does not custody user funds or private keys.

---

## Remaining Work

Current areas for future development include:

- Production-grade authentication and Premium subscriptions
- More reliable production RPC/indexer monitoring
- Additional advanced multi-leg strategy analysis
- Improved non-USDC payoff representation
- Broader portfolio settlement and realized P&L information
- Expanded strategy recommendation and comparison tools

---

## Disclaimer

NUTSCOPE is a hackathon prototype for educational and demonstration purposes.

Options trading involves financial risk. Paper-trading results do not guarantee future performance. Users remain responsible for reviewing and approving any real blockchain transaction through their own wallet.