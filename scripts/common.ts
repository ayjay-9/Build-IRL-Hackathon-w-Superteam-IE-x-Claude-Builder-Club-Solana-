import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Solana's official devnet RPC. Gets rate-limited hard on hackathon days
// (everyone in the room hits it at once) but has correctly-shaped
// responses, unlike some third-party mirrors. Override with SOLANA_RPC_URL
// if you have a better endpoint (e.g. a free Helius/QuickNode devnet key).
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

const WALLET_DIR = path.resolve("wallets");
const DATA_DIR = path.resolve("data");
if (!fs.existsSync(WALLET_DIR)) fs.mkdirSync(WALLET_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export function loadOrCreateKeypair(name: string): Keypair {
  const file = path.join(WALLET_DIR, `${name}.json`);
  if (fs.existsSync(file)) {
    const secret = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Non-blocking: try automated funding, but never stop the pipeline over it.
// If devnet's RPC is too congested, the person funds manually via the
// faucet website (a separate, usually more generous rate-limit pool) and
// later steps will just work once SOL has actually landed.
export async function ensureFunded(kp: Keypair, minSol = 0.3) {
  const addr = kp.publicKey.toBase58();
  try {
    const bal = await connection.getBalance(kp.publicKey);
    if (bal / LAMPORTS_PER_SOL >= minSol) {
      console.log(`  ${addr} already has ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
      return;
    }
  } catch (e: any) {
    console.warn(`  Could not check balance for ${addr} (${(e.message || e).toString().slice(0, 80)}) — trying airdrop anyway.`);
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`  Airdropping devnet SOL to ${addr} (attempt ${attempt}/2)...`);
      const sig = await connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`  Airdrop confirmed for ${addr}.`);
      return;
    } catch (e: any) {
      const msg = (e?.message || String(e)).toString().slice(0, 120);
      console.warn(`  Airdrop attempt ${attempt} failed: ${msg}`);
      if (attempt < 2) await sleep(4000);
    }
  }
  console.warn(`  Automated airdrop didn't go through for ${addr}.`);
  console.warn(`  Fund it manually at https://faucet.solana.com (select Devnet) — this address:`);
  console.warn(`  ${addr}`);
  await sleep(800);
}

export interface PaymentLogEntry {
  timestamp: string;
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  amount: number;
  status: "approved" | "rejected";
  reason?: string;
  signature?: string;
}

const LOG_FILE = path.join(DATA_DIR, "payments.json");

export function appendLog(entry: PaymentLogEntry) {
  let log: PaymentLogEntry[] = [];
  if (fs.existsSync(LOG_FILE)) {
    log = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  }
  log.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

export function saveState(key: string, value: any) {
  const file = path.join(DATA_DIR, "state.json");
  let state: any = {};
  if (fs.existsSync(file)) state = JSON.parse(fs.readFileSync(file, "utf-8"));
  state[key] = value;
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

export function loadState(): any {
  const file = path.join(DATA_DIR, "state.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
