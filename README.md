# Money Call Stack

Recursive, on-chain-enforced spending delegation for AI agents on Solana — built on SPL Token's
native `approve`/`transfer`/`revoke` instructions, no custom program.

See `CLAUDE.md` for the full architecture, the exact SPL Token instructions used, and the demo
script. Quick start:

```bash
npm run setup   # one-time devnet bootstrap
npm run dev     # http://localhost:3002 (3000 is taken by Grafana on this machine)
```

If `npm run setup` hangs or fails with `429 Too Many Requests` / `Connection rate limits exceeded`,
the shared public devnet RPC is overloaded (common on venue WiFi at a hackathon). Get a free
Helius devnet key at dev.helius.xyz (no card, ~60 seconds), then add to `.env.local`:

```
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

and re-run `npm run setup` — it picks up where it left off.

Optional: there's a CopilotKit chat panel that can trigger the same 5 actions as the buttons via
natural language ("delegate 400 to research"). To use it, add your key to
`.env.local` (`ANTHROPIC_API_KEY=...`) — without it, the buttons and on-chain logic work exactly
the same, only the chat errors. See `CLAUDE.md` → "CopilotKit chat panel" for how to remove it
entirely if it's not ready in time.
