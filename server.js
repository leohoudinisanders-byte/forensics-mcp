#!/usr/bin/env node
/**
 * On-chain Forensics MCP server.
 *
 * Gives any MCP-capable agent (Claude Desktop, Cursor, Claude Code, LangChain, custom
 * frameworks) token due-diligence tools backed by onchainforensics.dev. Zero dependencies,
 * newline-delimited JSON-RPC over stdio, so `npx github:leohoudinisanders-byte/forensics-mcp`
 * works without an install step and without a registry publish.
 *
 * Payment model: every tool first tries the free trial tier. When the free allowance for that
 * route is spent, the paid routes answer HTTP 402 and the tool returns the decoded x402 challenge
 * (price, asset, payTo, network) instead of an error, so an agent that can sign a payment can
 * proceed and an agent that cannot still learns the exact cost.
 *
 * Env:
 *   FORENSICS_BASE_URL  default https://api.onchainforensics.dev/functions
 *   FORENSICS_CHAIN     default base
 *   FORENSICS_TIMEOUT_MS default 45000
 */

const BASE = process.env.FORENSICS_BASE_URL || "https://api.onchainforensics.dev/functions";
const DEFAULT_CHAIN = process.env.FORENSICS_CHAIN || "base";
const TIMEOUT_MS = Number(process.env.FORENSICS_TIMEOUT_MS || 45000);
// A free developer key (10,000 calls/month, from https://api.onchainforensics.dev/functions/devKeys)
// turns every tool call into a no-payment data read. Without it the free-trial allowance and then
// the x402 challenge apply.
const DEV_KEY = (process.env.FORENSICS_DEV_KEY || "").trim();
const VERSION = "1.2.0";

const TOOLS = [
  {
    name: "token_verdict",
    description:
      "Should I touch this token? Returns a letter grade (A-F), verdict tier, activity score and a one-line roast for an EVM or Solana token, computed from supply, transfer activity, holder spread and registry checks. Answers the yes/no question before a buy.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Token contract address (0x...) or Solana mint" },
        chain: { type: "string", enum: ["base", "ethereum", "solana", "linea", "polygon", "arbitrum", "optimism", "bnb", "avalanche"], description: "Chain, default base" }
      },
      required: ["address"]
    },
    route: "verdictFast",
    params: (a) => ({ address: a.address, chain: a.chain || DEFAULT_CHAIN }),
    price: "free trial first; paid calls are $0.001"
  },
  {
    name: "token_mints",
    description:
      "Is this token being printed? Counts mint events and minted amount in a recent block window, flags mint authority, and states the window it actually covered. Use before buying a token whose supply you do not trust.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Token contract address" },
        chain: { type: "string", description: "Chain to read: base (default), ethereum, solana, linea, polygon, arbitrum, optimism, bnb or avalanche." }
      },
      required: ["address"]
    },
    route: "forensicsMints",
    params: (a) => ({ address: a.address, chain: a.chain || DEFAULT_CHAIN }),
    price: "free trial first; paid calls are $0.02"
  },
  {
    name: "settlesafe_check",
    description:
      "Can this token actually settle? Checks whether a tokenized asset is a known canonical registry asset, whether its ERC-20 interface is readable, and whether transfer is paused or restricted. Use before accepting it as collateral or payment.",
    inputSchema: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Ticker or address, for example bTSLA, NVDA, or 0x..." },
        chain: { type: "string", description: "Chain to read: base (default), ethereum, solana, linea, polygon, arbitrum, optimism, bnb or avalanche." }
      },
      required: ["asset"]
    },
    route: "forensicsEquitySettlesafe",
    params: (a) => ({ asset: a.asset, chain: a.chain || DEFAULT_CHAIN }),
    price: "free trial first; paid calls are $0.02"
  },
  {
    name: "token_profile",
    description:
      "Everything readable about a token in one call: supply, decimals, symbol, registry, holders, top wallets. Use when the verdict alone is not enough detail.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Token contract address" },
        chain: { type: "string", description: "Chain to read: base (default), ethereum, solana, linea, polygon, arbitrum, optimism, bnb or avalanche." }
      },
      required: ["address"]
    },
    route: "forensicsToken",
    params: (a) => ({ address: a.address, chain: a.chain || DEFAULT_CHAIN }),
    price: "free trial first; paid calls are $0.05"
  },
  {
    name: "wallet_profile",
    description:
      "Is this wallet real, and what does it hold? Nonce, balance, contract status and holdings checks. Use before trusting a counterparty address.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Wallet address" },
        chain: { type: "string", description: "Chain to read: base (default), ethereum, solana, linea, polygon, arbitrum, optimism, bnb or avalanche." }
      },
      required: ["address"]
    },
    route: "forensicsWallet",
    params: (a) => ({ address: a.address, chain: a.chain || DEFAULT_CHAIN }),
    price: "free trial first; paid calls are $0.05"
  },
  {
    name: "forensics_catalog",
    description:
      "List every available On-chain Forensics tool and its price. Free, no network call. Use when you need to know what else this server can answer or what a call will cost.",
    inputSchema: { type: "object", properties: {} },
    route: null
  }
];

// Display titles and read-only annotations. The annotations tell a client these tools only READ
// public chain state: nothing is signed, nothing is written, and the same arguments return the
// same answer, so a client can auto-approve them instead of prompting the user each time.
const TOOL_TITLES = {
  token_verdict: "Token verdict",
  token_mints: "Mint activity check",
  settlesafe_check: "Settle-safe screen",
  token_profile: "Token profile",
  wallet_profile: "Wallet profile",
  forensics_catalog: "Forensics catalog and prices",
};

function toolMeta(tool) {
  const title = TOOL_TITLES[tool.name] || tool.name;
  return {
    title,
    annotations: {
      title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  };
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function result(id, payload) {
  send({ jsonrpc: "2.0", id, result: payload });
}

function rpcError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function textResult(text, isError) {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

function decodeChallenge(headers) {
  const raw = headers.get("payment-required");
  if (!raw) return null;
  try {
    const bin = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(bin);
  } catch {
    try { return JSON.parse(raw); } catch { return null; }
  }
}

async function callRoute(tool, args) {
  const qs = new URLSearchParams({ ...tool.params(args), trial: "1" });
  const url = `${BASE}/${tool.route}?${qs}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let res;
  try {
    const headers = { "User-Agent": `forensics-mcp/${VERSION}` };
    if (DEV_KEY) headers["X-Dev-Key"] = DEV_KEY;
    res = await fetch(url, { signal: ac.signal, headers });
  } finally {
    clearTimeout(timer);
  }
  const bodyText = await res.text();

  if (res.status === 200) {
    let pretty = bodyText;
    try { pretty = JSON.stringify(JSON.parse(bodyText), null, 2); } catch { /* leave raw */ }
    return textResult(pretty);
  }

  if (res.status === 402) {
    const challenge = decodeChallenge(res.headers);
    const accept = challenge?.accepts?.[0];
    const line = accept
      ? `This call costs ${(Number(accept.amount) / 1e6).toFixed(4)} ${accept.asset === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" ? "USDC" : accept.asset} on ${accept.network} (payTo ${accept.payTo}). ${tool.price}.`
      : `This route is pay-per-call (${tool.price}).`;
    const payload = challenge
      ? JSON.stringify({ payment_required: { price_usd: accept ? Number(accept.amount) / 1e6 : null, network: accept?.network, asset: accept?.asset, pay_to: accept?.payTo, scheme: accept?.scheme }, challenge }, null, 2)
      : bodyText;
    return textResult(
      `${line}\nThe free trial allowance for this route is spent. Three ways forward: set FORENSICS_DEV_KEY to a free developer key (10,000 calls/month, POST ${BASE}/devKeys with an email), sign the x402 challenge below with any x402 client and retry, or buy a prepaid pack (POST ${BASE}/forensicsCredits).\n\n${payload}`
    );
  }

  return textResult(`HTTP ${res.status} from ${url}\n${bodyText.slice(0, 1200)}`, true);
}

let inflight = 0;

function handleToolCall(id, name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return rpcError(id, -32602, `unknown tool: ${name}`);

  if (!tool.route) {
    const catalog = TOOLS.map((t) => `- ${t.name}: ${t.price}\n  ${t.description.split(". ")[0]}.`).join("\n");
    return result(id, textResult(`On-chain Forensics tools:\n${catalog}\n\nBase URL: ${BASE}\nFree trial: one call per route per day, no key needed.\nFree developer key: POST ${BASE}/devKeys {"email":"you@example.com"} for 10,000 calls a month, then set FORENSICS_DEV_KEY.
Paid: x402 in USDC on Base, or a prepaid key from ${BASE}/forensicsCredits.`));
  }

  const missing = (tool.inputSchema.required || []).filter((k) => !args || args[k] === undefined || args[k] === "");
  if (missing.length) return rpcError(id, -32602, `missing required argument(s): ${missing.join(", ")}`);

  inflight += 1;
  callRoute(tool, args)
    .then((r) => result(id, r))
    .catch((e) => result(id, textResult(`request failed: ${e && e.message ? e.message : String(e)}`, true)))
    .finally(() => { inflight -= 1; });
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }

    if (msg.method === "initialize") {
      result(msg.id, {
        protocolVersion: msg.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "onchain-forensics", version: VERSION, title: "On-chain Forensics", websiteUrl: "https://onchainforensics.dev", icons: [{ src: "https://onchainforensics.dev/icon-512.png", mimeType: "image/png", sizes: ["512x512"] }] }
      });
      continue;
    }
    if (msg.method === "notifications/initialized" || msg.method === "initialized") continue;
    if (msg.method === "ping") { result(msg.id, {}); continue; }
    if (msg.method === "tools/list") { result(msg.id, { tools: TOOLS.map(({ route, params, price, ...t }) => ({ ...t, ...toolMeta(t) })) }); continue; }
    if (msg.method === "tools/call") {
      handleToolCall(msg.id, msg.params?.name, msg.params?.arguments || {});
      continue;
    }
    if (msg.id !== undefined) rpcError(msg.id, -32601, `method not found: ${msg.method}`);
  }
});

// A piped caller (echo ... | node server.js) closes stdin as soon as it has written its
// requests, so exiting immediately would kill in-flight HTTP calls. Wait for them to finish.
process.stdin.on("end", () => {
  const started = Date.now();
  const check = () => {
    if (inflight === 0 || Date.now() - started > TIMEOUT_MS + 5000) process.exit(0);
    else setTimeout(check, 50);
  };
  check();
});
