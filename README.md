# On-chain Forensics MCP server

[![Glama score](https://glama.ai/mcp/servers/leohoudinisanders-byte/forensics-mcp/badges/score.svg)](https://glama.ai/mcp/servers/leohoudinisanders-byte/forensics-mcp)

Token due-diligence tools for any MCP-capable agent: ask "should I touch this token" and get a
letter grade with a reason instead of a price chart. Zero dependencies, stdio transport, no
install step.

```bash
npx -y onchain-forensics-mcp
```

Published on npm as [`onchain-forensics-mcp`](https://www.npmjs.com/package/onchain-forensics-mcp).
If the registry is unreachable, the same code installs straight from GitHub:
`npx -y github:leohoudinisanders-byte/forensics-mcp`.

## Tools

| Tool | Question it answers | Price |
|---|---|---|
| `token_verdict` | Should I touch this token? Grade A-F, verdict tier, activity score, one-line roast. | free trial, then $0.001 |
| `token_mints` | Is this token being printed? Mint events, minted amount, mint authority, exact window. | free trial, then $0.02 |
| `settlesafe_check` | Can this token actually settle? Registry canonicality, ERC-20 readability, pause state. | free trial, then $0.02 |
| `token_profile` | Full readable profile: supply, decimals, holders, top wallets. | free trial, then $0.05 |
| `wallet_profile` | Is this wallet real, and what does it hold? | free trial, then $0.05 |
| `watch_token` | Stop asking: watch a token and email the human when its grade drops. | free (3 contracts), $29/30d for 50 + same-day alerts |
| `alerts_feed` | What turned risky lately? Public grade-change feed across Base and Ethereum. | free |
| `forensics_catalog` | What else can this server answer, and what does it cost? Free, no network call. | free |

## Alerts: the one tool that keeps answering after the agent stops

Every other tool answers a question once. `watch_token` subscribes the human to the same
grading engine, so a downgrade reaches them without another call:

- **Free:** up to 3 EVM contracts, one digest a day at 07:00 America/Chicago, nothing sent when
  nothing changed.
- **$29 / 30 days:** 50 contracts plus same-day mail on a full-grade drop or a hard red flag
  (mint authority back, liquidity drained, holder concentration spike). $75 / 90 days.
- Payment is USDC on Base over x402, no account and no card. Paying with an email that is
  already watching extends the subscription instead of stacking a second one.
- The public feed is free forever, day-by-day: <https://onchainforensics.dev/alerts-feed.html>
  (JSON and RSS at `/functions/alertsFeed`).

The tool asks only for an email address and contract addresses. It never invents a recipient.

Grades are computed by deterministic rules over live chain reads. No LLM sits in the decision
path, so the same token grades the same way twice.

## Install

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "onchain-forensics": {
      "command": "npx",
      "args": ["-y", "onchain-forensics-mcp"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add onchain-forensics -- npx -y onchain-forensics-mcp
```

Cursor (`.cursor/mcp.json`) and any other client use the same `command` + `args` pair.

LangChain / Vercel AI SDK / custom runtimes: the server speaks newline-delimited JSON-RPC 2.0 on
stdio, so it drops into any MCP client implementation. Methods implemented: `initialize`,
`tools/list`, `tools/call`, `ping`.

## Free developer key (10,000 calls/month)

```bash
curl -X POST https://api.onchainforensics.dev/functions/devKeys \
  -H "Content-Type: application/json" -d '{"email":"you@example.com"}'
```

The response contains a key shown once. Set it and every tool call becomes a plain data read with
no payment signature:

```json
{
  "mcpServers": {
    "onchain-forensics": {
      "command": "npx",
      "args": ["-y", "onchain-forensics-mcp"],
      "env": { "FORENSICS_DEV_KEY": "fxk_..." }
    }
  }
}
```

## Payment

Every tool calls the free trial tier first. When that route's daily allowance is spent, the paid
endpoint answers HTTP 402 and the tool returns the decoded x402 challenge (price, USDC asset,
payTo, network) rather than an error, so an agent that can sign a payment proceeds and an agent
that cannot still learns the exact cost.

- Pay per call: any x402 client against `https://api.onchainforensics.dev/functions/<route>`
- Prepaid keys (no signature per call): `POST /functions/forensicsCredits {"plan":"pack1"}`

## Env

| Variable | Default |
|---|---|
| `FORENSICS_BASE_URL` | `https://api.onchainforensics.dev/functions` |
| `FORENSICS_CHAIN` | `base` |
| `FORENSICS_TIMEOUT_MS` | `45000` |
| `FORENSICS_DEV_KEY` | empty (falls back to free trial, then the x402 challenge) |

## License

MIT

