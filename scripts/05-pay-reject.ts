import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import { connection, loadOrCreateKeypair, loadState, appendLog } from "./common.js";

const DECIMALS = 6;
const PAYMENT_AMOUNT = 10; // over the search agent's remaining ~4.8 mUSD allowance

function toBaseUnits(amount: number) {
  return BigInt(Math.round(amount * 10 ** DECIMALS));
}

async function main() {
  const state = loadState();
  const mint = new PublicKey(state.mint);
  const researchAccount = new PublicKey(state.researchAccount);

  const searchAgent = loadOrCreateKeypair("search-agent");
  const apiPayee = loadOrCreateKeypair("api-payee");

  console.log(`Search agent attempts to pay ${PAYMENT_AMOUNT} mUSD — over its delegated allowance.`);
  console.log("This should be REJECTED by the SPL Token program itself, on-chain.\n");

  const apiAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    apiPayee,
    mint,
    apiPayee.publicKey
  );

  try {
    const sig = await transfer(
      connection,
      searchAgent,
      researchAccount,
      apiAccount.address,
      searchAgent,
      toBaseUnits(PAYMENT_AMOUNT)
    );
    console.log("Unexpected: payment went through. Tx:", sig);
    appendLog({
      timestamp: new Date().toISOString(),
      from: "search-agent",
      fromLabel: "Search agent",
      to: "api-payee",
      toLabel: "Pay.sh API",
      amount: PAYMENT_AMOUNT,
      status: "approved",
      signature: sig,
    });
  } catch (e: any) {
    const reason = e?.message || String(e);
    console.log("PAYMENT REJECTED ON-CHAIN.");
    console.log("Reason:", reason);
    console.log("\nThis is the SPL Token program's own delegate-allowance check failing —");
    console.log("not app code deciding not to send the request. Nothing was moved.");

    appendLog({
      timestamp: new Date().toISOString(),
      from: "search-agent",
      fromLabel: "Search agent",
      to: "api-payee",
      toLabel: "Pay.sh API",
      amount: PAYMENT_AMOUNT,
      status: "rejected",
      reason: "Exceeds delegated allowance (on-chain SPL Token check)",
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
