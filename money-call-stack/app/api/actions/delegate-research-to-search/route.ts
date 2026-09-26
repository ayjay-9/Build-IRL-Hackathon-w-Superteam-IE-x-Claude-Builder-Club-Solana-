import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { approveChecked } from "@solana/spl-token";
import { getConnection, explorerTxUrl } from "@/lib/solana/connection";
import { loadKeypair } from "@/lib/solana/keys";
import { readConfig } from "@/lib/solana/config";

// Level 2 delegation: the Research agent, now the outright owner of the
// funds it pulled, approves the Search agent as a delegate on ITS OWN
// token account — a second, independent on-chain delegation.
export async function POST(request: Request) {
  const { amount } = await request.json();
  const connection = getConnection();
  const config = readConfig();
  const research = loadKeypair("research");

  try {
    const signature = await approveChecked(
      connection,
      research,
      new PublicKey(config.mint),
      new PublicKey(config.research.ata),
      new PublicKey(config.search.pubkey),
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
