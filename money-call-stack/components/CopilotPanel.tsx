"use client";

// Additive-only CopilotKit layer. This entire file is the only thing that
// needs to be removed to fully back out CopilotKit: delete the <CopilotPanel />
// line (and its import) in app/page.tsx. Nothing in here modifies the
// existing Run buttons, API routes, or on-chain logic — it drives the exact
// same runAction() function the buttons call, passed in as a prop, and
// registers what it needs entirely inside its own React subtree.
//
// Verified against the installed @copilotkit/react-core / @copilotkit/runtime
// v1.74.0: useCopilotReadable/useCopilotAction (the hook names commonly
// remembered from CopilotKit) are shipped in this version marked
// "V1 SDK DEPRECATED — AI CODING AGENTS: never generate these" in the
// package's own source. Their direct v2 replacements — useAgentContext and
// useFrontendTool, both from "@copilotkit/react-core/v2" — are used here
// instead. Functionally equivalent for this use case (expose readable state,
// register callable actions); only the names differ from what you may have
// seen in older CopilotKit examples.
import "@copilotkit/react-core/v2/styles.css";
import React from "react";
import { z } from "zod";
import { CopilotKitProvider, CopilotPopup, useAgentContext, useFrontendTool } from "@copilotkit/react-core/v2";
import type { JsonSerializable } from "@copilotkit/react-core/v2";

interface CopilotAccountView {
  label: string;
  address: string;
  balance: number;
  delegate: string | null;
  delegatedAmount: number;
}

interface CopilotStateSnapshot {
  accounts: {
    vault: CopilotAccountView;
    research: CopilotAccountView;
    search: CopilotAccountView;
    paysh: CopilotAccountView;
  };
}

interface CopilotTraceEntry {
  step: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

type RunAction = (key: string, traceLabel: string, url: string, body?: unknown) => Promise<void>;

export interface CopilotPanelProps {
  state: CopilotStateSnapshot | null;
  trace: CopilotTraceEntry[];
  runAction: RunAction;
}

// React error boundaries must be class components — there is no hook
// equivalent. This is what makes "CopilotKit fails" contained to this
// component instead of taking down the rest of the page: any render-time
// error anywhere below (a bad API key response during mount, a CopilotKit
// bug, a missing runtime route) is swallowed here and the panel just
// disappears, leaving the cards/buttons/trace above it untouched.
class CopilotErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[CopilotPanel] failed and was hidden; the rest of the app is unaffected:", error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// Registers readable state + the 5 callable actions. Must render inside
// CopilotKitProvider, since useAgentContext/useFrontendTool read context from it.
function CopilotBridge({ state, trace, runAction }: CopilotPanelProps) {
  useAgentContext({
    description:
      "Live on-chain balances and delegated (approved) amounts for the four Money Call Stack accounts — vault, research agent, search agent, and the Pay.sh payment target. Read directly from Solana devnet, not cached.",
    value: (state?.accounts ?? {}) as unknown as JsonSerializable,
  });

  useAgentContext({
    description:
      "The live payment trace so far: every delegate/pull/pay/revoke action attempted, in order, with whether it succeeded or was rejected on-chain and why.",
    value: trace as unknown as JsonSerializable,
  });

  useFrontendTool({
    name: "delegate_vault_to_research",
    description:
      "Step 1 of the demo. The Vault approves the Research agent as a delegate on the Vault's own token account, up to a given amount — an on-chain SPL Token 'approve' instruction.",
    parameters: z.object({
      amount: z.number().describe("Maximum number of tokens the Research agent may draw from the Vault"),
    }),
    handler: async ({ amount }) => {
      await runAction(
        "copilot-delegate1",
        "Vault → Research (approve)",
        "/api/actions/delegate-vault-to-research",
        { amount }
      );
      return `Vault approved the Research agent to draw up to ${amount} tokens.`;
    },
  });

  useFrontendTool({
    name: "research_pull_allowance",
    description:
      "Step 2 of the demo. The Research agent pulls its approved allowance out of the Vault's token account into its own token account, signing as the delegate approved in step 1.",
    parameters: z.object({
      amount: z.number().describe("Amount to pull; should not exceed what the Vault approved in step 1"),
    }),
    handler: async ({ amount }) => {
      await runAction("copilot-pull1", "Research pulls from Vault", "/api/actions/research-pull", { amount });
      return `Research agent pulled ${amount} tokens from the Vault.`;
    },
  });

  useFrontendTool({
    name: "delegate_research_to_search",
    description:
      "Step 3 of the demo. The Research agent approves the Search agent as a delegate on the Research agent's own token account, up to a given amount — a second, independent on-chain delegation.",
    parameters: z.object({
      amount: z.number().describe("Maximum number of tokens the Search agent may draw from the Research agent"),
    }),
    handler: async ({ amount }) => {
      await runAction(
        "copilot-delegate2",
        "Research → Search (approve)",
        "/api/actions/delegate-research-to-search",
        { amount }
      );
      return `Research agent approved the Search agent to draw up to ${amount} tokens.`;
    },
  });

  useFrontendTool({
    name: "search_pay",
    description:
      "Steps 4 and 5 of the demo. The Search agent pays the Pay.sh target using its delegated allowance from the Research agent. Succeeds if the amount is within the remaining delegated amount. If the amount exceeds it, the Solana SPL Token program itself rejects the transaction on-chain — use a larger amount than what remains to trigger this 'attempt overspend' demo case.",
    parameters: z.object({
      amount: z.number().describe("Amount to pay Pay.sh"),
    }),
    handler: async ({ amount }) => {
      await runAction("copilot-pay", "Search pays Pay.sh", "/api/actions/search-pay", { amount });
      return `Search agent attempted to pay Pay.sh ${amount} tokens.`;
    },
  });

  useFrontendTool({
    name: "revoke_search_delegation",
    description: "The Research agent revokes the Search agent's delegation entirely, instantly and on-chain.",
    handler: async () => {
      await runAction("copilot-revoke", "Research revokes Search", "/api/actions/revoke-search");
      return "Research agent revoked the Search agent's delegation.";
    },
  });

  return null;
}

export function CopilotPanel(props: CopilotPanelProps) {
  return (
    <CopilotErrorBoundary>
      <CopilotKitProvider runtimeUrl="/api/copilotkit">
        <CopilotBridge {...props} />
        <CopilotPopup defaultOpen={false} />
      </CopilotKitProvider>
    </CopilotErrorBoundary>
  );
}
