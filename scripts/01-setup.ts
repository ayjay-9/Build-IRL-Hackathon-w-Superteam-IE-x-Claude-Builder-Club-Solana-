import { SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { connection, loadOrCreateKeypair, ensureFunded, saveState } from "./common.js";

const TOPUP_SOL = 0.05; // enough for several transactions' worth of fees

async function main() {
  console.log("Setting up wallets for: vault authority, research agent, search agent, pay.sh mock API\n");

  const vaultAuthority = loadOrCreateKeypair("vault-authority");
  const researchAgent = loadOrCreateKeypair("research-agent");
  const searchAgent = loadOrCreateKeypair("search-agent");
  const apiPayee = loadOrCreateKeypair("api-payee");

  console.log("Vault authority:", vaultAuthority.publicKey.toBase58(), "  <-- fund THIS one via faucet");
  console.log("Research agent :", researchAgent.publicKey.toBase58());
  console.log("Search agent   :", searchAgent.publicKey.toBase58());
  console.log("API payee      :", apiPayee.publicKey.toBase58());

  console.log("\nFunding only the vault authority from the faucet (saves faucet requests)...\n");
  await ensureFunded(vaultAuthority, 0.3);

  const vaultBalance = await connection.getBalance(vaultAuthority.publicKey).catch(() => 0);
  if (vaultBalance / LAMPORTS_PER_SOL < TOPUP_SOL * 3 + 0.01) {
    console.warn("\nVault authority still doesn't have enough SOL yet.");
    console.warn("Fund this exact address via https://faucet.solana.com (Devnet) or your hackathon's faucet:");
    console.warn(vaultAuthority.publicKey.toBase58());
    console.warn("\nThen just re-run: npm run setup  (it will pick up from here automatically)");
    saveState("wallets", {
      vaultAuthority: vaultAuthority.publicKey.toBase58(),
      researchAgent: researchAgent.publicKey.toBase58(),
      searchAgent: searchAgent.publicKey.toBase58(),
      apiPayee: apiPayee.publicKey.toBase58(),
    });
    return;
  }

  console.log("\nVault authority funded. Topping up the other 3 wallets with a direct SOL transfer");
  console.log("(no faucet needed for these — just moving a little SOL from the vault authority)...\n");

  for (const [label, kp] of [
    ["research agent", researchAgent],
    ["search agent", searchAgent],
    ["api payee", apiPayee],
  ] as const) {
    const bal = await connection.getBalance(kp.publicKey).catch(() => 0);
    if (bal / LAMPORTS_PER_SOL >= TOPUP_SOL) {
      console.log(`  ${label} already funded.`);
      continue;
    }
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: vaultAuthority.publicKey,
          toPubkey: kp.publicKey,
          lamports: Math.round(TOPUP_SOL * LAMPORTS_PER_SOL),
        })
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [vaultAuthority]);
      console.log(`  Topped up ${label} (${kp.publicKey.toBase58()}). Tx: ${sig}`);
    } catch (e: any) {
      console.warn(`  Could not top up ${label}: ${(e.message || e).toString().slice(0, 150)}`);
    }
  }

  saveState("wallets", {
    vaultAuthority: vaultAuthority.publicKey.toBase58(),
    researchAgent: researchAgent.publicKey.toBase58(),
    searchAgent: searchAgent.publicKey.toBase58(),
    apiPayee: apiPayee.publicKey.toBase58(),
  });

  console.log("\nSetup complete. Next: npm run init-vault");
}

main().catch((e) => { console.error(e); process.exit(1); });
