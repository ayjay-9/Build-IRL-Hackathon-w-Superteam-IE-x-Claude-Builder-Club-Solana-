# Money Call Stack

Programmable spending delegation for AI agents on Solana — built at BUILD
IRL Vol. 1 (Superteam Ireland x Claude Builder Club), Dogpatch Labs Dublin,
26 Sept 2026.

**Tagline:** Every AI payment has an ancestry.

## The core idea

A vault holds a total budget. It delegates a spending allowance to a
Research agent, which delegates a smaller slice to a Search agent — using
Solana's native SPL Token `approve`/delegate mechanic, so the limit is
enforced by the token program itself, on-chain, not by application code.

- A payment within the delegated allowance succeeds.
- A payment over the allowance is rejected on-chain, by the SPL Token
  program's own delegate-amount check — not by our code deciding not to
  send it.

## Why this generalizes (pitch/vision slide, not built today)

The underlying primitive here isn't really "AI agent spending limits" —
it's **a vault whose fund release is gated by an on-chain-enforced
condition, instead of trusted application code**. That gate can be:

- a **delegated spending authority** (what we built: an agent can only
  move what it was actually delegated), or
- a **verified external event** (a teammate's parametric-insurance
  concept: a whitelisted oracle posts a confirmed event, e.g. a cloud
  outage, and pooled funds release automatically — no claims process, no
  human discretion).

Both are the same shape: funds sit under program control, and release
only when a specific, independently verifiable condition is satisfied
on-chain. We're building and demoing the agent-delegation version today;
the insurance/oracle version is one slide showing the core engine isn't
single-purpose — same PDA/authority-gated pattern, a different trigger.

## Requirements

- Node.js 18+
- A Solflare (or any) wallet is NOT required to run this — the scripts
  generate and fund their own devnet keypairs.

## Setup

```bash
npm install
npm run setup        # generates 4 devnet keypairs, airdrops SOL to each
```

If an airdrop fails (devnet faucet is rate-limited), fund the printed
address manually at https://faucet.solana.com, then re-run `npm run setup`.

## Run the full demo

```bash
npm run demo
```

Runs in order: `init-vault` (creates mock currency, funds vault, delegates
to research agent) → `delegate` (research agent draws its slice, delegates
to search agent — the recursive step) → `pay-success` (0.2 mUSD, succeeds)
→ `pay-reject` (10 mUSD, rejected on-chain).

## View the trace

```bash
npm run serve
```

Open http://localhost:5173 — delegation tree + live payment trace, with
links to each transaction on Solana Explorer (devnet).

## Status

Code is written and type-checks cleanly (`npx tsc --noEmit -p .`), but has
**not yet been run end-to-end** — the build environment couldn't reach
Solana's devnet RPC. Running the setup → demo steps above for real, and
confirming the reject case actually throws the expected on-chain error, is
the next thing to do.

## Where this simplifies (be upfront in Q&A)

The Research agent's account actually receives custody of its slice
(pulled via its own delegate authority from the vault), rather than funds
staying in one program-controlled vault the whole way down. That's the
fast, buildable path using stock SPL Token instructions — no custom
program or Rust/Anchor toolchain needed. The stronger version (a single
PDA-owned vault where only *authority*, never custody, moves at every
level) is the natural v2, mentioned as future work if asked.

## Files

```
scripts/
  common.ts          shared helpers: keypairs, devnet airdrop, payment log
  01-setup.ts         generate + fund wallets
  02-init-vault.ts    create mock currency, fund vault, delegate to research agent
  03-delegate.ts      research agent draws its slice, delegates to search agent
  04-pay-success.ts   payment within allowance (succeeds)
  05-pay-reject.ts    payment over allowance (rejected on-chain)
data/
  state.json          addresses created during setup (mint, accounts)
  payments.json        running log of every payment attempt, read by the frontend
frontend/
  index.html          budget tree + payment trace viewer
wallets/               generated devnet keypairs (gitignored, not committed)
```
