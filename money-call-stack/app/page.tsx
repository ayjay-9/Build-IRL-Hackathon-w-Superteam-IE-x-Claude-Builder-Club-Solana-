"use client";

import { useEffect, useState } from "react";

type AccountView = {
  label: string;
  address: string;
  explorerUrl: string;
  balance: number;
  delegate: string | null;
  delegatedAmount: number;
};

type StateResponse = {
  mint: string;
  decimals: number;
  accounts: {
    vault: AccountView;
    research: AccountView;
    search: AccountView;
    paysh: AccountView;
  };
};

type TraceEntry = {
  id: number;
  step: string;
  success: boolean;
  signature?: string;
  explorerUrl?: string;
  error?: string;
  logs?: string[];
  timestamp: string;
};

let traceId = 0;

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

function AccountCard({ account }: { account: AccountView }) {
  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-neutral-900">{account.label}</div>
      <a
        href={account.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="block truncate text-xs text-blue-600 hover:underline"
      >
        {account.address}
      </a>
      <div className="mt-2 text-2xl font-bold text-neutral-900">{account.balance}</div>
      <div className="text-xs text-neutral-500">balance</div>
      {account.delegate && (
        <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          delegate: {account.delegate.slice(0, 4)}...{account.delegate.slice(-4)}
          <br />
          allowance remaining: <strong>{account.delegatedAmount}</strong>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [amounts, setAmounts] = useState({
    delegate1: 400,
    pull1: 400,
    delegate2: 150,
    payOk: 100,
    payFail: 100,
  });

  async function refreshState() {
    const res = await fetch("/api/state");
    const json = await res.json();
    if (!res.ok) {
      setStateError(json.error ?? "Failed to load state");
      return;
    }
    setStateError(null);
    setState(json);
  }

  useEffect(() => {
    // Initial load of on-chain state; refreshState() is re-used after every
    // action too, so it's defined outside the effect on purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshState();
  }, []);

  async function runAction(key: string, traceLabel: string, url: string, body?: unknown) {
    setBusy(key);
    try {
      const result = await post(url, body);
      setTrace((prev) => [
        {
          id: traceId++,
          step: traceLabel,
          success: !!result.success,
          signature: result.signature,
          explorerUrl: result.explorerUrl,
          error: result.error,
          logs: result.logs,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      await refreshState();
    } finally {
      setBusy(null);
    }
  }

  const steps = [
    {
      key: "delegate1",
      label: "1. Vault delegates allowance to Research",
      amountKey: "delegate1" as const,
      action: () => runAction("delegate1", "Vault → Research (approve)", "/api/actions/delegate-vault-to-research", { amount: amounts.delegate1 }),
    },
    {
      key: "pull1",
      label: "2. Research pulls its allowance",
      amountKey: "pull1" as const,
      action: () => runAction("pull1", "Research pulls from Vault", "/api/actions/research-pull", { amount: amounts.pull1 }),
    },
    {
      key: "delegate2",
      label: "3. Research delegates sub-allowance to Search",
      amountKey: "delegate2" as const,
      action: () => runAction("delegate2", "Research → Search (approve)", "/api/actions/delegate-research-to-search", { amount: amounts.delegate2 }),
    },
    {
      key: "payOk",
      label: "4. Search pays Pay.sh (within allowance)",
      amountKey: "payOk" as const,
      action: () => runAction("payOk", "Search pays Pay.sh (within allowance)", "/api/actions/search-pay", { amount: amounts.payOk }),
    },
    {
      key: "payFail",
      label: "5. Search attempts overspend (should be rejected on-chain)",
      amountKey: "payFail" as const,
      action: () => runAction("payFail", "Search attempts overspend", "/api/actions/search-pay", { amount: amounts.payFail }),
    },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-neutral-900">Money Call Stack</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Recursive, on-chain-enforced spending delegation for AI agents — using SPL Token&apos;s native
        approve/delegate instructions, no custom program. Vault → Research agent → Search agent → Pay.sh.
      </p>

      {stateError && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {stateError} — run <code>npm run setup</code> in a terminal, then refresh this page.
        </div>
      )}

      {state && (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <AccountCard account={state.accounts.vault} />
          <AccountCard account={state.accounts.research} />
          <AccountCard account={state.accounts.search} />
          <AccountCard account={state.accounts.paysh} />
        </div>
      )}

      <div className="mt-8 space-y-3">
        {steps.map((step) => (
          <div key={step.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
            <div className="min-w-0 flex-1 text-sm text-neutral-800">{step.label}</div>
            <input
              type="number"
              value={amounts[step.amountKey]}
              onChange={(e) =>
                setAmounts((prev) => ({ ...prev, [step.amountKey]: Number(e.target.value) }))
              }
              className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <button
              onClick={step.action}
              disabled={busy !== null}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === step.key ? "Sending..." : "Run"}
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <div className="min-w-0 flex-1 text-sm text-neutral-600">
            Optional: Research revokes Search&apos;s delegation entirely (on-chain, instant)
          </div>
          <button
            onClick={() => runAction("revoke", "Research revokes Search", "/api/actions/revoke-search")}
            disabled={busy !== null}
            className="rounded border border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:opacity-40"
          >
            Revoke
          </button>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-neutral-900">Live payment trace</h2>
      <div className="mt-3 space-y-2">
        {trace.length === 0 && <div className="text-sm text-neutral-500">No actions yet — run step 1 above.</div>}
        {trace.map((entry) => (
          <div
            key={entry.id}
            className={`rounded-lg border p-3 text-sm ${
              entry.success ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{entry.success ? "✅ " : "⛔ "}{entry.step}</span>
              <span className="text-xs text-neutral-500">{entry.timestamp}</span>
            </div>
            {entry.success && entry.explorerUrl && (
              <a href={entry.explorerUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                View real devnet transaction on Solana Explorer →
              </a>
            )}
            {!entry.success && (
              <div className="mt-1 whitespace-pre-wrap font-mono text-xs text-red-800">
                {entry.error}
                {entry.logs?.length ? "\n" + entry.logs.join("\n") : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
