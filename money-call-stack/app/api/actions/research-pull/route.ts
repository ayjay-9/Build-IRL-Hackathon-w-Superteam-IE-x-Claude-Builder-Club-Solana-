import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { transferChecked } from "@solana/spl-token";
import { getConnection, explorerTxUrl } from "@/lib/solana/connection";
import { loadKeypair } from "@/lib/solana/keys";
import { readConfig } from "@/lib/solana/config";

// The Research agent pulls its drawn allowance out of the vault's token
// account into its OWN token account. It signs as the DELEGATE on the
// vault's account, not as its owner — the SPL Token program checks that
// `amount` does not exceed what was approved in the previous step.
//
// v1 simplification (accepted for the hackathon): funds move into the
// child's own account rather than staying in one PDA the whole way down.
export async function POST(request: Request) {
  const { amount } = await request.json();
  const connection = getConnection();
  const config = readConfig();
  const research = loadKeypair("research");

  try {
    const signature = await transferChecked(
      connection,
      research,
      new PublicKey(config.vault.ata),
      new PublicKey(config.mint),
      new PublicKey(config.research.ata),
      research,
      Math.round(amount * 10 ** config.decimals),
      config.decimals
    );
    return NextResponse.json({ success: true, signature, explorerUrl: explorerTxUrl(signature) });
  } catch (err: unknown) {
    const e = err as { message?: string; logs?: string[] };
    return NextResponse.json({ success: false, error: e.message ?? String(err), logs: e.logs }, { status: 400 });
  }
}
