# Money Call Stack — context for Claude Code

Hackathon: BUILD IRL Vol. 1 (Superteam Ireland x Claude Builder Club),
Dogpatch Labs Dublin, 26 Sept 2026, 10:00-18:00. €3,000 prize, open track,
best build using Solana. Pitch is 3 minutes; submission slides must be
.pptx. Submission form: tally.so/r/rj7oqN

## Team decision on scope (made 14:21, ~3.5h before deadline)

A teammate proposed a second idea (parametric outage insurance — see
"Why this generalizes" in README.md). Assessed as a genuine architectural
fit (both are "vault gated by an on-chain-enforced condition," just a
different trigger type) but too risky to build both from scratch in the
time left. Decision: keep Money Call Stack as the ONLY built demo, and
mention the insurance use case as a one-slide "this generalizes" bullet
in the pitch, no code. Do not build a second on-chain flow unless
explicitly told the scope changed again.

## The idea

"Money Call Stack" — programmable spending delegation for AI agents on
Solana. Tagline: "Every AI payment has an ancestry."

Problem: AI agents can already pay for APIs autonomously (via Pay.sh, a
sponsor tool). The open problem: when one agent hires another to do a
sub-task, how much can it spend, who authorized it, what stops it
overspending? Today that's just trusted to application code.

Solution: a vault delegates a spending allowance down a chain (Vault ->
Research agent -> Search agent), using Solana's native SPL Token
`approve`/delegate instruction. A payment within the allowance succeeds;
over it, it's rejected ON-CHAIN by the SPL Token program itself, not by
app logic. Every payment traces back to its original funder.

## Architecture decision (already made, don't relitigate)

Three separate review passes converged: funds must not simply transfer to
a child agent's own wallet (that's just a debit card; the "why
blockchain" defense collapses). Given hackathon time constraints (no
Rust/Anchor toolchain readily available, single day to ship), we chose
the FAST, REALISTIC path: Solana's native SPL Token `approve`/delegate
instruction, zero custom program code.

Honest simplification to disclose if asked: the Research agent's account
actually receives custody of its slice (pulled via its own delegate
authority), rather than funds staying in one program-controlled vault the
whole way down. The stronger version (single PDA-owned vault, only
authority moves) needs a custom Anchor program — mention as v2/future
work only, do not attempt to build it today.

## What's built (in this repo)

- `scripts/common.ts` — keypair load/create, devnet airdrop, JSON payment
  log (`data/payments.json`), state store (`data/state.json`).
- `scripts/01-setup.ts` — generates 4 devnet keypairs (vault authority,
  research agent, search agent, api payee) and funds them.
- `scripts/02-init-vault.ts` — creates a mock SPL token ("mUSD", 6
  decimals), mints 20 into the vault, approves research agent as delegate
  for up to 20.
- `scripts/03-delegate.ts` — research agent draws its 5 mUSD slice from
  the vault, then approves search agent as delegate for up to 5.
- `scripts/04-pay-success.ts` — search agent pays 0.2 mUSD. Should succeed.
- `scripts/05-pay-reject.ts` — search agent attempts 10 mUSD. Should be
  REJECTED by the SPL Token program on-chain.
- `frontend/index.html` — plain HTML/JS (no build step), reads
  `data/payments.json`, renders delegation tree + live payment trace with
  Explorer links. Served via `npm run serve`.
- `README.md` — full run instructions and the merge-scope narrative.

All scripts type-check cleanly (`npx tsc --noEmit -p .`).

## What's NOT yet verified — do this FIRST, right now

The code has never been run end-to-end. It was written in a
network-sandboxed environment that could not reach api.devnet.solana.com
(proxy blocked it, HTTP 403). Do this immediately:

1. `npm install`
2. `npm run setup` — watch for airdrop failures (devnet faucet commonly
   rate-limited); if one fails, fund that address manually at
   https://faucet.solana.com and re-run `npm run setup`.
3. `npm run init-vault`
4. `npm run delegate`
5. `npm run pay-success` — confirm it succeeds, capture the real tx
   signature.
6. `npm run pay-reject` — confirm it actually throws/rejects, and record
   the EXACT error text SPL Token returns — the pitch leans on "the
   network itself rejected it," so get the real wording.
7. `npm run serve`, open http://localhost:5173, confirm tree + trace
   render and Explorer links work.

If anything errors: likely culprits are devnet flakiness/rate limits, an
`@solana/spl-token` API signature mismatch (check the installed version
if a function signature looks wrong), or insufficient SOL for fees on one
of the four wallets.

## Remaining scope (only after the above is verified working)

- Real Pay.sh integration (currently `api-payee` is a stand-in wallet —
  see pay.sh/docs to wire an actual paid API call gated by the same
  delegation check).
- SAS (Solana Attestation Service) as a precondition before an agent gets
  any delegated allowance — mock as one manually-issued attestation
  checked as a boolean, not a live KYC flow.
- A fixed scope tag string (e.g. "search-api-only") on the delegation,
  checked alongside amount — not derived from a prompt.
- Do NOT build: the parametric-insurance flow, multi-level hierarchies
  beyond one delegation, expiry timestamps, or real NLP-derived intent
  scoping. Pitch-deck bullets only.

## Pitch framing

- Lead with the failure case: "AI agents can buy things now. When an
  agent hires another agent, what stops it draining your wallet? You
  can't rely on a database you don't control."
- Demo order: successful delegated payment -> trace its ancestry in the
  UI -> oversized payment attempt -> rejected on-chain with the real
  error.
- Precise phrasing (avoid overclaiming): "every payment has a
  cryptographically verifiable on-chain ancestry" — not "physically
  impossible to overspend," not "proves why the AI made a decision."
- Why not a database: a traditional backend is both custodian and
  enforcer (one company's code decides, could be wrong or bypassed);
  here funds and the rule governing them are the same on-chain object,
  independently verifiable by anyone.
- Novelty answer: the differentiator is recursive delegation + full
  payment ancestry tracing, not "spending limits" alone.
- Vision/close: mention the same vault-gate primitive generalizes beyond
  agent spending — e.g. parametric insurance payouts gated by an
  oracle-confirmed event (a teammate's idea) — as ONE closing line, not a
  built feature.

## Full build-and-test guide

More detail (wallet/faucet basics, build order, what to mock vs build)
already exists as a Claude Docs doc:
https://claude.ai/code/artifact/e092c330-a38a-4b0f-9b79-cb08d3ecb97a
