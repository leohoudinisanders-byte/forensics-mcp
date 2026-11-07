# On-chain Forensics MCP server

Token due-diligence tools for any MCP-capable agent: ask "should I touch this token" and get a
letter grade with a reason instead of a price chart. Zero dependencies, stdio transport, no
install step.

```bash
npx github:leohoudinisanders-byte/forensics-mcp
```

## Tools

| Tool | Question it answers | Price |
|---|---|---|
| `token_verdict` | Should I touch this token? Grade A-F, verdict tier, activity score, one-line roast. | free trial, then $0.001 |
| `token_mints` | Is this token being printed? Mint events, minted amount, mint authority, exact window. | free trial, then $0.02 |
| `settlesafe_check` | Can this token actually settle? Registry canonicality, ERC-20 readability, pause state. | free trial, then $0.02 |
| `token_profile` | Full readable profile: supply, decimals, holders, top wallets. | free trial, then $0.05 |
| `wallet_profile` | Is this wallet real, and what does it hold? | free trial, then $0.05 |
| `forensics_catalog` | What else can this server answer, and what does it cost? Free, no network call. | free |

Grades are computed by deterministic rules over live chain reads. No LLM sits in the decision
path, so the same token grades the same way twice.

## Install

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "onchain-forensics": {
      "command": "npx",
      "args": ["-y", "github:leohoudinisanders-byte/forensics-mcp"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add onchain-forensics -- npx -y github:leohoudinisanders-byte/forensics-mcp
```

Cursor (`.cursor/mcp.json`) and any other client use the same `command` + `args` pair.

LangChain / Vercel AI SDK / custom runtimes: the server speaks newline-delimited JSON-RPC 2.0 on
stdio, so it drops into any MCP client implementation. Methods implemented: `initialize`,
`tools/list`, `tools/call`, `ping`.

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

## License

MIT
