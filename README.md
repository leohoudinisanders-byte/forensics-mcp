# On-chain Forensics — MCP Server (x402-payable tools)

Due-diligence forensics for AI agents, exposed as [MCP](https://modelcontextprotocol.io/) tools over streamable HTTP.

**Endpoint:** `https://solene-fa2010da.base44.app/functions/forensicsMcp`

**Operator:** Leo Sanders (leohoudinisanders@gmail.com). Deep research with receipts: the agent that ships working proof, not promises.

## Tools

| Tool | Price | What it does |
|------|-------|--------------|
| `forensics_info` | free | Service directory, chains, aliases, usage |
| `token_verdict` | $0.02 | Token verdict card: activity score 0-100, verdict tier, transfers, whale/concentration flags, plain-English take. EVM (address+chain) or XRPL (issuer+currency) |
| `settle_safe` | $0.02 | Pre-trade settle-safe screen for tokenized equities/RWAs: canonical-registry check, freeze/clawback flags, optional counterparty trust tier |
| `wallet_screen` | $0.05 | Wallet trust screen: flows, counterparties, contract-interaction risk, trust tier (Base/Ethereum/XRPL) |
| `token_profile` | $0.05 | Full ERC-20 forensics: 24h net supply change, mint/burn events, concentration, top transfers |
| `diligence_memo` | $0.25 ($0.35 with counterparty) | Composed Token Due-Diligence Memo: verdict + forensics + settle-safe screen, decision-grade |

## Payment (x402 v2)

No API keys, no signup — the payment IS the auth.

1. Call a paid tool: `tools/call` returns **HTTP 402** with a `PAYMENT-REQUIRED` header (x402 v2 challenge, USDC on Base, eip155:8453).
2. Sign the EIP-3009 authorization with your wallet.
3. Retry with the `X-PAYMENT` header. Settlement on Base mainnet; the tool result is served.

Any x402-capable client (e.g. [x402 fetch](https://docs.x402.org)) handles this automatically. The tools are also indexed in the Coinbase x402 Bazaar as MCP resources (type `mcp`, transport `streamable-http`).

## Listed in the official MCP Registry

Published at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) as
`io.github.leohoudinisanders-byte/forensics-mcp` v1.0.0 (remote, streamable-http).

## Related

- Landing: https://leohoudinisanders-byte.github.io/onchain-forensics/
- OpenAPI 3.1: https://leohoudinisanders-byte.github.io/onchain-forensics/openapi.json
- REST API: https://solene-fa2010da.base44.app/functions/forensicsApi
- Canton Swap Broker (OneSwap x402 wrapper): https://leohoudinisanders-byte.github.io/canton-swap-broker/
