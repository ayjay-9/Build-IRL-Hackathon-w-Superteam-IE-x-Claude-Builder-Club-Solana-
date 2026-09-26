/**
 * One-shot devnet setup for the Money Call Stack demo.
 *
 * Creates four keypairs (vault, research agent, search agent, Pay.sh target),
 * airdrops devnet SOL for fees, mints a demo budget token, creates an
 * associated token account for each identity, and mints the vault's budget.
 *
 * Run once with: npm run setup
 * Safe to re-run — it skips any keypair that already exists in ./keys,
 * but will create a fresh mint each time it's run.
 */
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection } from "../lib/solana/connection";
import { loadKeypair, saveKeypair, keypairExists, type AgentName } from "../lib/solana/keys";
import { writeConfig } from "../lib/solana/config";

const DECIMALS = 2;
const VAULT_BUDGET = 1000; // whole tokens, minted to the vault at setup

async function ensureKeypair(name: AgentName): Promise<Keypair> {
  if (keypairExists(name)) {
    console.log(`Using existing keypair for ${name}`);
    return loadKeypair(name);
  }
  const kp = Keypair.generate();
  saveKeypair(name, kp);
  console.log(`Generated new keypair for ${name}: ${kp.publicKey.toBase58()}`);
  return kp;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = 800 * (i + 1);
      console.log(`${label} failed (attempt ${i + 1}/${attempts}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

// The shared public devnet RPC (api.devnet.solana.com) rate-limits hard,
// especially on hackathon-venue WiFi where many teams hit it at once — its
// airdrop faucet has a small daily quota per IP that a busy venue can burn
// through fast. If requestAirdrop fails outright (not just a transient
// 429), that's usually the faucet being out, not a bug — see the manual
// funding instructions this script prints below, or get a free Helius
// devnet API key (dev.helius.xyz, ~60 seconds, no card) and set
// SOLANA_RPC_URL in .env.local for a less-contended RPC.
//
// Returns true if the account ends up funded, false if it still needs
// manual funding.
async function ensureFunded(connection: ReturnType<typeof getConnection>, pubkey: PublicKey, label: string): Promise<boolean> {
  const balance = await withRetry(() => connection.getBalance(pubkey), `getBalance(${label})`);
  if (balance >= 0.05 * LAMPORTS_PER_SOL) {
    console.log(`${label} already funded (${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL)`);
    return true;
  }
  console.log(`Airdropping devnet SOL to ${label}...`);
  try {
    const signature = await withRetry(() => connection.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL), `requestAirdrop(${label})`, 2);
    await withRetry(() => connection.confirmTransaction(signature, "confirmed"), `confirmTransaction(${label})`);
    await sleep(500); // be polite to the shared devnet faucet before the next account
    return true;
  } catch (err) {
    console.log(`Could not airdrop to ${label}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  const connection = getConnection();

  const vault = await ensureKeypair("vault");
  const research = await ensureKeypair("research");
  const search = await ensureKeypair("search");
  const paysh = await ensureKeypair("paysh");

  const parties = [
    [vault, "vault"],
    [research, "research"],
    [search, "search"],
    [paysh, "paysh"],
  ] as const;

  const unfunded: string[] = [];
  for (const [kp, label] of parties) {
    const funded = await ensureFunded(connection, kp.publicKey, label);
    if (!funded) unfunded.push(`${label}: ${kp.publicKey.toBase58()}`);
  }

  if (unfunded.length > 0) {
    console.log("\nSetup paused — these accounts still need devnet SOL:");
    unfunded.forEach((line) => console.log("  " + line));
    console.log("\nThe automatic airdrop is likely rate-limited (common on shared hackathon WiFi).");
    console.log("Fund each address above manually, then re-run `npm run setup` — it will");
    console.log("skip everything already done and pick up where it left off:");
    console.log("  1. https://faucet.solana.com (paste each address, select devnet)");
    console.log("  2. Or, if you have the Solana CLI: solana airdrop 1 <ADDRESS> --url devnet");
    console.log("  3. Or ask a mentor/teammate on different WiFi to send devnet SOL to these addresses");
    process.exit(1);
  }

  console.log("Creating demo budget mint...");
  const mint = await createMint(connection, vault, vault.publicKey, null, DECIMALS);
  console.log("Mint:", mint.toBase58());

  console.log("Creating associated token accounts...");
  const vaultAta = await getOrCreateAssociatedTokenAccount(connection, vault, mint, vault.publicKey);
  const researchAta = await getOrCreateAssociatedTokenAccount(connection, research, mint, research.publicKey);
  const searchAta = await getOrCreateAssociatedTokenAccount(connection, search, mint, search.publicKey);
  const payshAta = await getOrCreateAssociatedTokenAccount(connection, paysh, mint, paysh.publicKey);

  console.log(`Minting ${VAULT_BUDGET} tokens to the vault...`);
  await mintTo(connection, vault, mint, vaultAta.address, vault, VAULT_BUDGET * 10 ** DECIMALS);

  writeConfig({
    mint: mint.toBase58(),
    decimals: DECIMALS,
    vault: { pubkey: vault.publicKey.toBase58(), ata: vaultAta.address.toBase58() },
    research: { pubkey: research.publicKey.toBase58(), ata: researchAta.address.toBase58() },
    search: { pubkey: search.publicKey.toBase58(), ata: searchAta.address.toBase58() },
    paysh: { pubkey: paysh.publicKey.toBase58(), ata: payshAta.address.toBase58() },
  });

  console.log("\nSetup complete. keys/config.json written.");
  console.log(`Vault budget: ${VAULT_BUDGET} tokens in ${vaultAta.address.toBase58()}`);
  console.log("Run `npm run dev` and open http://localhost:3000");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
