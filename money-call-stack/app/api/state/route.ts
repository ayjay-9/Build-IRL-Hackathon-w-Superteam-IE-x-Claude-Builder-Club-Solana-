import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAccount, type Account } from "@solana/spl-token";
import { getConnection, explorerAddressUrl } from "@/lib/solana/connection";
import { readConfig } from "@/lib/solana/config";

function format(account: Account, label: string, decimals: number) {
  return {
    label,
    address: account.address.toBase58(),
    explorerUrl: explorerAddressUrl(account.address.toBase58()),
    balance: Number(account.amount) / 10 ** decimals,
    delegate: account.delegate ? account.delegate.toBase58() : null,
    delegatedAmount: account.delegate ? Number(account.delegatedAmount) / 10 ** decimals : 0,
  };
}

// Reads LIVE on-chain state for all four token accounts — this is not a
// local mirror. Balances and delegated amounts always reflect what the
// SPL Token program actually has recorded on devnet.
export async function GET() {
  try {
    const config = readConfig();
    const connection = getConnection();

    const [vault, research, search, paysh] = await Promise.all([
      getAccount(connection, new PublicKey(config.vault.ata)),
      getAccount(connection, new PublicKey(config.research.ata)),
      getAccount(connection, new PublicKey(config.search.ata)),
      getAccount(connection, new PublicKey(config.paysh.ata)),
    ]);

    return NextResponse.json({
      mint: config.mint,
      decimals: config.decimals,
      accounts: {
        vault: format(vault, "Vault", config.decimals),
        research: format(research, "Research Agent", config.decimals),
        search: format(search, "Search Agent", config.decimals),
        paysh: format(paysh, "Pay.sh (target)", config.decimals),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Run `npm run setup` first — keys/config.json not found or not readable.", detail: String(err) },
      { status: 400 }
    );
  }
}
