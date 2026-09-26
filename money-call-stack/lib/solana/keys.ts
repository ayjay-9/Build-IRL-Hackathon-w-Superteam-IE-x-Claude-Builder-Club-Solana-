import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

// These keypairs represent the four on-chain identities in the demo:
// the vault, the two agents, and the payment target. They are generated
// once by scripts/setup.ts and reused by every API route. Never expose
// the raw secret key bytes to client-side code — only import this file
// from server code (route handlers, scripts).
export type AgentName = "vault" | "research" | "search" | "paysh";

const KEYS_DIR = path.join(process.cwd(), "keys");

function keyPath(name: AgentName) {
  return path.join(KEYS_DIR, `${name}.json`);
}

export function loadKeypair(name: AgentName): Keypair {
  const raw = fs.readFileSync(keyPath(name), "utf-8");
  const secret = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secret);
}

export function saveKeypair(name: AgentName, kp: Keypair) {
  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(keyPath(name), JSON.stringify(Array.from(kp.secretKey)));
}

export function keypairExists(name: AgentName) {
  return fs.existsSync(keyPath(name));
}
