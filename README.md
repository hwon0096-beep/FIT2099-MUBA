I want you to update the project README so it clearly satisfies the hackathon documentation requirements.

IMPORTANT:
- Inspect the current README first.
- Preserve any correct technical details already there.
- Do NOT invent contract addresses, testnet deployments, SDK behavior, environment variables, or team contributions.
- Do NOT change application code.
- This task is README/documentation only.
- If a required detail is not actually present in the repository, clearly mark it as needing confirmation instead of guessing.

The README must clearly cover:

1. Project description
2. Problem statement
3. Blockchain technology used
4. Smart contract addresses / network information
5. Setup and installation instructions
6. Team members

==================================================
1. PROJECT TITLE
==================================================

Use:

# NUTSCOPE — Thetanuts Options Explorer

Add a short opening description:

NUTSCOPE is a crypto options discovery, analysis, paper-trading, and execution platform built on top of Thetanuts Finance V4 OptionBook on Base.

Explain that users can:

- discover live options opportunities
- browse live Thetanuts OptionBook orders
- analyze payoff and risk
- use Strategy Lab with virtual funds
- compare/save strategies
- execute real non-custodial trades through their own wallet

==================================================
2. PROJECT DESCRIPTION
==================================================

Add a clear section:

## Project Description

Explain the workflow:

Discover → Markets → Analyze → Strategy Lab → Trade

Describe:

Discover:
- live market overview
- live crypto prices
- live OptionBook order summary
- strategy opportunities

Markets:
- detailed live orders
- filters for outlook, asset, type, expiry, premium, size
- suggested live opportunities

Analyze:
- payoff/risk analysis
- break-even
- max profit
- max loss
- scenario P&L
- moneyness
- DTE where supported

Strategy Lab:
- paper trading
- virtual USDC
- saved strategies
- compare
- Free/Premium access
- advanced strategy exploration where supported

Trade:
- real non-custodial wallet flow
- Base
- MetaMask/injected wallet
- approvals and signing handled by wallet

==================================================
3. PROBLEM STATEMENT
==================================================

Add:

## Problem Statement

Explain that on-chain options are powerful but difficult for less experienced users because they involve:

- Calls/Puts
- strike
- expiry
- premium
- break-even
- payoff
- multi-leg structures
- large numbers of live orders

Explain that a user may not know:

- which contract fits their outlook
- how much they can lose
- when they profit
- what happens under different price scenarios
- whether they should practice first

Then explain NUTSCOPE's solution:

find → understand → simulate → execute

Make clear that Thetanuts is load-bearing to the product because live OptionBook data powers discovery, analysis and execution.

==================================================
4. BLOCKCHAIN TECHNOLOGY USED
==================================================

Add:

## Blockchain Technology Used

Include only verified details from the repo:

- Blockchain: Base
- Chain ID: 8453
- Environment: Base Mainnet
- Protocol: Thetanuts Finance V4 OptionBook
- Wallet: injected wallet such as MetaMask
- SDK: @thetanuts-finance/thetanuts-client

If the repo contains the actual ThetanutsClient setup, include a small verified example such as:

new ThetanutsClient({
  chainId: 8453,
  provider
})

Also mention the verified SDK calls currently used, if present:

client.api.fetchOrders()
client.api.getMarketData()
client.api.getBookProtocolStats()

Do not invent method names.

==================================================
5. SMART CONTRACT ADDRESSES / TESTNET
==================================================

Add:

## Smart Contract Addresses

IMPORTANT:
The current app uses Base Mainnet.

Do NOT invent testnet addresses.

If the project does not deploy its own contract, say that explicitly.

Use wording similar to:

"NUTSCOPE currently integrates with existing Thetanuts infrastructure on Base Mainnet (Chain ID 8453). The project does not deploy a custom NUTSCOPE smart contract."

Then inspect the repo for any verified contract addresses.

If actual Thetanuts contract addresses are clearly present in:
- SDK config
- server config
- constants
- deployment files

include only those verified addresses.

If no explicit addresses are safely discoverable, write:

"Contract addresses are resolved through the existing Thetanuts SDK/protocol integration. No separate NUTSCOPE testnet deployment is used."

Do NOT guess.

If the hackathon specifically requires testnet addresses but none exist, add a short note:

"Testnet contract addresses: Not applicable — this prototype currently integrates with Base Mainnet."

==================================================
6. THETANUTS INTEGRATION
==================================================

Preserve and clean up the current technical section.

Mention:

Frontend wrapper:
src/lib/thetanuts.ts

Server integration:
server/thetanuts.ts

Browser endpoint:
GET /api/thetanuts

Mention verified SDK calls and timeout/error behavior if they are still accurate.

Do not claim mock fallback if the app does not use one.

==================================================
7. TRADE EXECUTION
==================================================

Preserve the current real-trade documentation.

Explain:

Wallet connection:
src/lib/WalletContext.tsx

Pre-flight validation:
src/lib/tradePreflight.ts

Trade flow:
src/FillFlow.tsx

Cover verified behavior such as:

- wallet connection
- Base network check/switch
- order validation
- expiry validation
- amount validation
- availability validation
- previewFillOrder
- allowance
- fillOrder
- revalidation before execution

Do not add new claims.

==================================================
8. PAYOFF / ANALYSIS
==================================================

Preserve the current payoff section but organize it clearly.

Mention verified files:

src/lib/payoff.ts
src/lib/spreadPayoff.ts
src/lib/orderPayoff.ts

Explain:

- vanilla Call/Put payoff
- two-leg vertical debit spread support where verified
- break-even
- max loss
- max profit
- scenario P&L
- premium denomination handling

Preserve the non-USDC denomination warning if it is still valid.

==================================================
9. SETUP AND INSTALLATION
==================================================

Add/keep:

## Setup and Installation

Requirements:
- Node.js 18+
- npm
- modern browser
- MetaMask/injected wallet only for real trading

Commands:

npm install

npm run dev

Document:

Frontend:
http://127.0.0.1:5173

Backend:
http://127.0.0.1:8787

Also include:

npm run build

npm test

If current dev behavior may select a different Vite port when 5173 is occupied, do not overstate that 5173 is guaranteed.

==================================================
10. ENVIRONMENT VARIABLES
==================================================

Add/keep:

## Environment Variables

Example:

BASE_RPC_URL=
PREMIUM_PASSWORD=
GEMINI_API_KEY=

Never include real credentials.

Explain:

BASE_RPC_URL
- optional
- server-side only
- Base RPC

PREMIUM_PASSWORD
- server-side prototype premium access

GEMINI_API_KEY
- only needed if the AI Analyst feature uses Gemini
- other app features should remain available if AI is unavailable, if that is still true

Do NOT use VITE_ for secrets.

==================================================
11. PREMIUM DEMO ACCESS
==================================================

Keep the hackathon demo section only if the current implementation actually supports the demo code.

If verified, document:

NUTSCOPE2026

But clearly label it:

Prototype/demo access only

Do not describe it as production authentication.

If PREMIUM_PASSWORD overrides the demo code, preserve that only if it is actually implemented.

==================================================
12. PROJECT STRUCTURE
==================================================

Add a compact project structure section with the main relevant files/pages:

Discover
Markets
Analyze
Strategy Lab
Trade
Portfolio

Only list actual file paths.

Do not make this section too long.

==================================================
13. DEPLOYMENT
==================================================

Preserve the current deployment section if still valid.

Mention:

render.yaml
start.ts

Explain:
npm run build
dist/
Express serves API + frontend

Do not invent hosting configuration.

==================================================
14. TEAM MEMBERS
==================================================

Add:

## Team Members

Create a table.

Use the actual team names/contributions only if they are clearly available from the repo or current README.

If not known, use placeholders such as:

| Team Member | 
| Angeline Regina Lee | 
| Hui Qing Wong | 
| See Eng Chin|

Do NOT invent teammates' names.

==================================================
15. SAFETY
==================================================

Add:

## Safety

Clearly separate:

Strategy Lab:
- virtual funds
- no real USDC
- no blockchain transaction

Live Trading:
- real Base Mainnet
- real wallet approvals/signatures
- user reviews transaction in wallet
- NUTSCOPE does not store private keys

==================================================
16. REMAINING WORK
==================================================

Keep a short honest section:

## Remaining Work

Include only realistic future work such as:

- production-grade auth/subscriptions
- stronger RPC/indexer monitoring
- broader multi-leg analysis
- improved non-USDC payoff display
- richer portfolio settlement/P&L
- expanded strategy comparison/recommendation

Do not make this section too long.

==================================================
17. DISCLAIMER
==================================================

Add a short disclaimer:

NUTSCOPE is a hackathon prototype for educational and demonstration purposes.
Options trading involves risk.
Paper trading does not guarantee future performance.
Users remain responsible for reviewing and approving real wallet transactions.

==================================================
18. IMPORTANT WRITING STYLE
==================================================

Make the README:

- professional
- concise but complete
- hackathon-ready
- easy for judges to scan
- technically honest
- clear about what is real vs simulated

Use headings and bullets.

Do not make it read like a giant internal engineering document.

Put the most judge-relevant information near the top:
Project Description
Problem Statement
Blockchain Technology
Smart Contract / Network Info
Setup
Team Members

Move deeper technical implementation details lower down.

==================================================
19. VERIFICATION BEFORE FINALIZING
==================================================

Before editing, inspect the repo and verify:

- chain ID
- whether Base Mainnet or testnet is used
- actual environment variables
- whether PREMIUM demo code is still supported
- SDK methods used
- route names
- file paths
- whether custom smart contracts exist
- whether testnet addresses exist

If something is uncertain, say so in the README rather than guessing.

Then modify ONLY README.md.

Afterward report:

1. Sections added
2. Sections reorganized
3. Any technical claims you corrected
4. Whether any contract addresses were found
5. Whether testnet is applicable
6. Any placeholders still requiring team input

Do not modify application source code.