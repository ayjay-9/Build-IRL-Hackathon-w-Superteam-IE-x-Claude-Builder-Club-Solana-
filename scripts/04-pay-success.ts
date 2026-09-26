import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import { connection, loadOrCreateKeypair, loadState, appendLog } from "./common.js";

const DECIMALS = 6;
const PAYMENT_AMOUNT = 0.2; // well within the search agent's 5 mUSD allowance

function toBaseUnits(amount: number) {
  return BigInt(Math.round(amount * 10 ** DECIMALS));
}

async function main() {
  const state = loadState();
  const mint = new PublicKey(state.mint);
  const researchAccount = new PublicKey(state.researchAccount);

  const searchAgent = loadOrCreateKeypair("search-agent");
  const apiPayee = loadOrCreateKeypair("api-payee");

  console.log(`Search agent attempts to pay ${PAYMENT_AMOUNT} mUSD for an API call via Pay.sh.`);
  console.log("This is within its 5 mUSD delegated allowance, so it should succeed.\n");

  const apiAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    apiPayee,
    mint,
    apiPayee.publicKey
  );

  try {
    const sig = await transfer(
      connection,
      searchAgent,       // fee payer
      researchAccount,   // source: research agent's account (search agent only holds a DELEGATED allowance over it)
      apiAccount.address,
      searchAgent,        // authority = the delegate (search agent), not the account owner
      toBaseUnits(PAYMENT_AMOUNT)
    );
    console.log("PAYMENT APPROVED. Tx:", sig);
    console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);

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
    console.error("Payment failed unexpectedly:", e.message || e);
    appendLog({
      timestamp: new Date().toISOString(),
      from: "search-agent",
      fromLabel: "Search agent",
      to: "api-payee",
      toLabel: "Pay.sh API",
      amount: PAYMENT_AMOUNT,
      status: "rejected",
      reason: e.message || String(e),
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
