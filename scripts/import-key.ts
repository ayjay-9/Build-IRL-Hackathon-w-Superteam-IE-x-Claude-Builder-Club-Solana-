// Import an existing wallet's private key (exported from Solflare/Phantom)
// as this project's vault-authority wallet, so it doesn't need a fresh
// faucet grant if it already has devnet SOL.
//
// Usage:
//   SOLFLARE_SECRET="<base58 string from Solflare>" npm run import-key
//
// Your key is read from an environment variable, in your own terminal —
// it is never sent anywhere, typed into chat, or logged.

import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const secret = process.env.SOLFLARE_SECRET;
if (!secret) {
  console.error("Missing SOLFLARE_SECRET. Run it like:");
  console.error('  SOLFLARE_SECRET="your-base58-private-key" npm run import-key');
  process.exit(1);
}

let keypair: Keypair;
try {
  const decoded = bs58.decode(secret.trim());
  keypair = Keypair.fromSecretKey(decoded);
} catch (e) {
  console.error("Could not parse that key. Make sure you exported the private key");
  console.error("as a base58 string (Solflare: Settings -> Export Private Key).");
  process.exit(1);
}

const WALLET_DIR = path.resolve("wallets");
if (!fs.existsSync(WALLET_DIR)) fs.mkdirSync(WALLET_DIR, { recursive: true });
const file = path.join(WALLET_DIR, "vault-authority.json");
fs.writeFileSync(file, JSON.stringify(Array.from(keypair.secretKey)));

console.log("Imported. This wallet is now the vault authority:");
console.log(keypair.publicKey.toBase58());
console.log("\nNext: npm run setup");
