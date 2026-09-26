import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { approveChecked } from "@solana/spl-token";
import { getConnection, explorerTxUrl } from "@/lib/solana/connection";
import { loadKeypair } from "@/lib/solana/keys";
import { readConfig } from "@/lib/solana/config";

// Level 1 delegation: the vault's owner approves the Research agent as a
// delegate on the vault's own token account, up to `amount`. The token
// program now enforces this ceiling on-chain — no app-level check needed.
export async function POST(request: Request) {
  const { amount } = await request.json();
  const connection = getConnection();
  const config = readConfig();
  const vault = loadKeypair("vault");

  try {
    const signature = await approveChecked(
      connection,
      vault,
      new PublicKey(config.mint),
      new PublicKey(config.vault.ata),
      new PublicKey(config.research.pubkey),
      vault,
      Math.round(amount * 10 ** config.decimals),
      config.decimals
    );
    return NextResponse.json({ success: true, signature, explorerUrl: explorerTxUrl(signature) });
  } catch (err: unknown) {
    const e = err as { message?: string; logs?: string[] };
    return NextResponse.json({ success: false, error: e.message ?? String(err), logs: e.logs }, { status: 400 });
  }
}
