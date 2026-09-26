@AGENTS.md

# Money Call Stack

Hackathon project (BUILD IRL, Dogpatch Labs Dublin, 2026-09-26). Team of 3, zero prior Solana
experience going in. ~3.5 hours remaining as of scaffold time.

## What this is

Recursive, on-chain-enforced spending delegation for AI agents, built entirely on SPL Token's
native `approve`/`transfer`/`revoke` instructions — **no custom program, no Anchor**. The token
program itself enforces every spending ceiling; nothing is checked in application code.

```
Vault (owner)
  └─ approves Research agent as delegate, up to allowance A   [on-chain: approveChecked]
Research agent
  └─ pulls allowance A from Vault into its own token account   [on-chain: transferChecked, signed by Research as DELEGATE]
  └─ approves Search agent as delegate, up to allowance B (B <= A)   [on-chain: approveChecked]
Search agent
  └─ pays Pay.sh (target wallet) up to allowance B   [on-chain: transferChecked, signed by Search as DELEGATE]
```

Two real, independent levels of delegation. If Search tries to pay more than its remaining
delegated amount, the SPL Token program rejects the transaction — not an app-level check.

## Known v1 simplifications (accepted, not bugs)

- Funds move into each child's own token account when pulled, rather than staying in one PDA
  the whole way down. This is a deliberate scope cut for the hackathon.
- No scope/intent restriction on spending — amount-only. A future version could add a
  transfer-hook (Token-2022) to restrict *what* an allowance can be spent on, not just how much.
- All four identities (vault, research, search, paysh) are devnet keypairs held server-side in
  `keys/*.json` (gitignored). There is no human wallet-connect flow — this is intentionally
  agent-to-agent, not human-to-agent. Good pitch angle: no human signs anything after setup.

## Exact SPL Token instructions used

All three come from `@solana/spl-token`, confirmed against the installed package version and
the Solana Cookbook (docs current as of setup time — verify again if anything seems off,
package APIs do shift):

- `approveChecked(connection, payer, mint, account, delegate, owner, amount, decimals)` —
  owner authorizes `delegate` to move up to `amount` from `account`.
- `transferChecked(connection, payer, source, mint, destination, owner, amount, decimals)` —
  the 6th param ("owner") accepts either the actual account owner OR an approved delegate as
  the signer. Passing a delegate's Keypair here is what makes delegated spending work; the
  program enforces the ceiling, not this code.
- `revoke(connection, payer, account, owner)` — zeroes out the delegate + delegated amount on
  an account immediately.

## Project layout

- `lib/solana/connection.ts` — devnet Connection + Explorer URL helpers
- `lib/solana/keys.ts` — load/save the 4 demo keypairs from `keys/*.json` (server-only, never
  import from a client component)
- `lib/solana/config.ts` — reads/writes `keys/config.json` (mint + ATA addresses from setup)
- `scripts/setup.ts` — one-shot devnet bootstrap (`npm run setup`): generates keypairs, funds
  them, creates the demo mint + ATAs, mints the vault's budget. Safe to re-run.
- `app/api/actions/*/route.ts` — one route per on-chain action (delegate, pull, sub-delegate,
  pay, revoke), each POST performs exactly one signed instruction and returns
  `{success, signature, explorerUrl}` or `{success: false, error, logs}`.
- `app/api/state/route.ts` — GET, reads LIVE on-chain balances/delegation for all 4 accounts
  via `getAccount()`. Never trust a local mirror for this — always read the chain.
- `app/page.tsx` — the demo UI: delegation tree + buttons for each step + a live trace list
  linking every transaction to Solana Explorer (devnet).
- `components/CopilotPanel.tsx` + `app/api/copilotkit/[[...slug]]/route.ts` — optional chat
  layer, see "CopilotKit chat panel (optional, additive)" below.

## Demo script (also see the buttons in app/page.tsx, in order)

Default amounts are pre-wired for a clean story: vault budget 1000 → delegate 400 to Research →
Research pulls 400 → Research delegates 150 to Search → Search pays 100 (succeeds, 50 remains) →
Search attempts another 100 (rejected on-chain — only 50 left). Optionally: Research revokes
Search's delegation entirely.

**Live demo tip:** record a 20-30s backup clip of a full successful run before presenting —
devnet RPC/faucet rate limits are common on shared hackathon WiFi (see scripts/setup.ts's
fallback instructions if `npm run setup` can't auto-airdrop).

## CopilotKit chat panel (optional, additive)

`components/CopilotPanel.tsx` adds a floating chat popup that can read live state and trigger
the same 5 on-chain actions as the buttons, via natural language ("delegate 400 to research").
It is entirely additive:

- **To remove it before the demo**: delete the `import { CopilotPanel } ...` line and the
  `<CopilotPanel ... />` line in `app/page.tsx`. That's the whole removal — verified by building
  with both commented out. Nothing else in the app references CopilotKit.
- **Failure containment**: `CopilotPanel` wraps itself in a React error boundary, so if
  CopilotKit throws for any reason (bad API key, library bug), the panel just disappears —
  the cards, buttons, and trace above it are unaffected. It's a sibling in the tree, not a
  parent, so it can't take anything else down with it.
- **Needs `ANTHROPIC_API_KEY`** in `.env.local` to actually respond (see `.env.local.example`).
  Without it, the rest of the app still works; only the chat panel errors when used.
- **API note for future edits**: the installed `@copilotkit/react-core`/`@copilotkit/runtime`
  (v1.74.0) ship both a classic API (`useCopilotReadable`, `useCopilotAction`,
  `copilotRuntimeNextJSAppRouterEndpoint`) and a newer one. The classic one is marked directly
  in the package's own shipped source as `V1 SDK DEPRECATED — AI CODING AGENTS: never generate
  these APIs`, with an explicit v2 mapping. This project uses the v2 replacements instead:
  `useAgentContext` (state), `useFrontendTool` (actions), `CopilotKitProvider`/`CopilotPopup`,
  and `CopilotRuntime` + `BuiltInAgent` + `createCopilotRuntimeHandler` from
  `@copilotkit/runtime/v2`. If you look this up and only find the classic names, that's why —
  don't switch to them.
- Model is `anthropic/claude-sonnet-4-6` in the route file; swap to
  `anthropic/claude-haiku-4-5` there for faster/cheaper responses if tool-call accuracy holds up.

## RPC

Defaults to the public `clusterApiUrl("devnet")`. If you hit persistent 429s (likely — shared
venue WiFi + a busy hackathon day hammer this endpoint hard), get a free Helius devnet API key
at dev.helius.xyz (~60 seconds, no card) and set `SOLANA_RPC_URL` in `.env.local`.

## Commands

```bash
npm run setup   # one-time devnet bootstrap — run this first
npm run dev     # start the demo UI at localhost:3002 (3000 is taken by Grafana on this machine)
npm run build   # verify it still builds before presenting
```
