import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  approve,
} from "@solana/spl-token";
import { connection, loadOrCreateKeypair, loadState, saveState } from "./common.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const DECIMALS = 6;
const VAULT_TOTAL = 20; // "20 mUSD" total budget
const RESEARCH_ALLOWANCE = 20; // research agent may draw up to the full vault

function toBaseUnits(amount: number) {
  return BigInt(Math.round(amount * 10 ** DECIMALS));
}

async function waitUntilFunded(pubkey: import("@solana/web3.js").PublicKey, minSol = 0.015, maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const bal = await connection.getBalance(pubkey, "confirmed");
    if (bal / LAMPORTS_PER_SOL >= minSol) {
      console.log(`  ${pubkey.toBase58()} confirmed funded with ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL (attempt ${attempt}/${maxAttempts}).`);
      return;
    }
    console.log(`  Waiting for RPC to catch up on ${pubkey.toBase58()}'s balance (attempt ${attempt}/${maxAttempts}, saw ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL so far)...`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Gave up waiting for ${pubkey.toBase58()} to show as funded on this RPC connection.`);
}

async function main() {
  const vaultAuthority = loadOrCreateKeypair("vault-authority");
  const researchAgent = loadOrCreateKeypair("research-agent");

  console.log("Confirming vault authority funding is visible to this RPC connection...");
  await waitUntilFunded(vaultAuthority.publicKey);

  console.log("Creating mock currency (mUSD, devnet-only token)...");
  const mint = await createMint(
    connection,
    vaultAuthority,
    vaultAuthority.publicKey,
    null,
    DECIMALS
  );
  console.log("Mint:", mint.toBase58());

  console.log("Creating the vault token account (owned by vault authority)...");
  const vaultAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    vaultAuthority,
    mint,
    vaultAuthority.publicKey
  );
  console.log("Vault account:", vaultAccount.address.toBase58());

  console.log(`Minting ${VAULT_TOTAL} mUSD into the vault...`);
  await mintTo(
    connection,
    vaultAuthority,
    mint,
    vaultAccount.address,
    vaultAuthority,
    toBaseUnits(VAULT_TOTAL)
  );

  console.log(`Delegating ${RESEARCH_ALLOWANCE} mUSD spending allowance to the research agent...`);
  console.log("(The vault authority still OWNS the funds. The research agent only gets");
  console.log(" permission to move up to this amount — this is enforced by the SPL Token");
  console.log(" program itself, on-chain, not by any app code.)");
  const approveSig = await approve(
    connection,
    vaultAuthority,
    vaultAccount.address,
    researchAgent.publicKey,
    vaultAuthority,
    toBaseUnits(RESEARCH_ALLOWANCE)
  );
  console.log("Approve tx:", approveSig);

  saveState("mint", mint.toBase58());
  saveState("vaultAccount", vaultAccount.address.toBase58());
  saveState("vaultTotal", VAULT_TOTAL);
  saveState("researchAllowance", RESEARCH_ALLOWANCE);

  console.log("\nVault initialized. Next: npm run delegate");
}

main().catch((e) => { console.error(e); process.exit(1); });
