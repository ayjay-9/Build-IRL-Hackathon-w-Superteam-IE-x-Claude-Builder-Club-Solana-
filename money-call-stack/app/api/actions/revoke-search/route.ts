import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { revoke } from "@solana/spl-token";
import { getConnection, explorerTxUrl } from "@/lib/solana/connection";
import { loadKeypair } from "@/lib/solana/keys";
import { readConfig } from "@/lib/solana/config";

// Optional 6th demo beat: the Research agent (parent) can cut off the
// Search agent's spending authority instantly, on-chain, without needing
// the Search agent's cooperation. Resets delegate + delegatedAmount to
// zero on the Research agent's token account.
export async function POST() {
  const connection = getConnection();
  const config = readConfig();
  const research = loadKeypair("research");

  try {
    const signature = await revoke(connection, research, new PublicKey(config.research.ata), research);
    return NextResponse.json({ success: true, signature, explorerUrl: explorerTxUrl(signature) });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ success: false, error: e.message ?? String(err) }, { status: 400 });
  }
}
