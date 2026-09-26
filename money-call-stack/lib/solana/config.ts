import fs from "fs";
import path from "path";

export type AgentConfig = { pubkey: string; ata: string };

export type DemoConfig = {
  mint: string;
  decimals: number;
  vault: AgentConfig;
  research: AgentConfig;
  search: AgentConfig;
  paysh: AgentConfig;
};

const CONFIG_PATH = path.join(process.cwd(), "keys", "config.json");

export function readConfig(): DemoConfig {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

export function writeConfig(config: DemoConfig) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
