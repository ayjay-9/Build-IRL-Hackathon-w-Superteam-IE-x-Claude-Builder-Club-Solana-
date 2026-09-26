import { PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  approve,
} from "@solana/spl-token";
import { connection, loadOrCreateKeypair, loadState, saveState, appendLog } from "./common.js";

const DECIMALS = 6;
const RESEARCH_DRAW = 5; // research agent pulls its working slice out of the vault
const SEARCH_ALLOWANCE = 5; // and delegates all of it onward to the search agent

function toBaseUnits(amount: number) {
  return BigInt(Math.round(amount * 10 ** DECIMALS));
}
function fromBaseUnits(amount: bigint) {
  return Number(amount) / 10 ** DECIMALS;
}

async function main() {
  const state = loadState();
  const mint = new PublicKey(state.mint);
  const vaultAccount = new PublicKey(state.vaultAccount);

  const vaultAuthority = loadOrCreateKeypair("vault-authority"); // signs nothing here, kept for reference
  const researchAgent = loadOrCreateKeypair("research-agent");
  const searchAgent = loadOrCreateKeypair("search-agent");

  console.log(`Research agent draws its working slice (${RESEARCH_DRAW} mUSD) from the vault`);
  console.log("using the delegate authority the vault approved to it. This is the recursive");
  console.log("step: the research agent becomes a mini-vault for its own sub-agent.\n");

  const researchAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    researchAgent,
    mint,
    researchAgent.publicKey
  );

  const drawSig = await transfer(
    connection,
    researchAgent, // fee payer + the delegate signing this transfer
    vaultAccount,
    researchAccount.address,
    researchAgent, // authority = the delegate, NOT the vault owner
    toBaseUnits(RESEARCH_DRAW)
  );
  console.log("Draw tx:", drawSig);
  console.log(`Research agent account now holds ${RESEARCH_DRAW} mUSD:`, researchAccount.address.toBase58());

  console.log(`\nResearch agent delegates ${SEARCH_ALLOWANCE} mUSD to the search agent...`);
  const approveSig = await approve(
    connection,
    researchAgent,
    researchAccount.address,
    searchAgent.publicKey,
    researchAgent,
    toBaseUnits(SEARCH_ALLOWANCE)
  );
  console.log("Approve tx:", approveSig);

  appendLog({
    timestamp: new Date().toISOString(),
    from: "vault",
    fromLabel: "Vault",
    to: "research-agent",
    toLabel: "Research agent",
    amount: RESEARCH_DRAW,
    status: "approved",
    signature: drawSig,
  });
  appendLog({
    timestamp: new Date().toISOString(),
    from: "research-agent",
    fromLabel: "Research agent",
    to: "search-agent",
    toLabel: "Search agent (delegated allowance)",
    amount: SEARCH_ALLOWANCE,
    status: "approved",
    reason: "Delegation grant, not a spend",
    signature: approveSig,
  });

  saveState("researchAccount", researchAccount.address.toBase58());
  saveState("searchAllowance", SEARCH_ALLOWANCE);

  console.log("\nDelegation chain set up: Vault -> Research agent -> Search agent.");
  console.log("Next: npm run pay-success (a payment within allowance)");
  console.log("Then: npm run pay-reject (a payment over allowance, rejected on-chain)");
}

main().catch((e) => { console.error(e); process.exit(1); });
