import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { transferChecked } from "@solana/spl-token";
import { getConnection, explorerTxUrl } from "@/lib/solana/connection";
import { loadKeypair } from "@/lib/solana/keys";
import { readConfig } from "@/lib/solana/config";

// The Search agent spends from the Research agent's account as its
// delegate, paying the Pay.sh target. This is the same endpoint for both
// demo cases: pass an amount within the remaining delegated amount and it
// succeeds; pass one over it and the SPL Token program itself rejects the
// transaction (no app-level check — this is the real "wow" moment).
export async function POST(request: Request) {
  const { amount } = await request.json();
  const connection = getConnection();
  const config = readConfig();
  const search = loadKeypair("search");

  try {
    const signature = await transferChecked(
      connection,
      search,
      new PublicKey(config.research.ata),
      new PublicKey(config.mint),
      new PublicKey(config.paysh.ata),
      search,
      Math.round(amount * 10 ** config.decimals),
      config.decimals
    );
    return NextResponse.json({ success: true, signature, explorerUrl: explorerTxUrl(signature) });
  } catch (err: unknown) {
    const e = err as { message?: string; logs?: string[] };
    // On an over-allowance attempt, the SPL Token program returns a real
    // error (commonly logged as "Error: insufficient funds" / custom
    // program error 0x1). Capture and show err.logs verbatim in the UI —
    // that real log line is the strongest thing you can put on a slide.
    return NextResponse.json({ success: false, error: e.message ?? String(err), logs: e.logs }, { status: 400 });
  }
}
