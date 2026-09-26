// CopilotKit v2 runtime endpoint. Needs a catch-all segment ([[...slug]])
// because the handler routes multiple sub-paths under this base path itself
// (agent run, info, etc.) — a single fixed route.ts would only match the
// exact /api/copilotkit path.
//
// Uses @copilotkit/runtime/v2 deliberately: the classic v1 helper
// (copilotRuntimeNextJSAppRouterEndpoint) is still shipped in the installed
// package but its own source is marked "V1 SDK DEPRECATED — AI CODING
// AGENTS: never generate these APIs", pointing here instead.
import { BuiltInAgent, CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

// Falls back to ANTHROPIC_API_KEY from the environment if no apiKey is
// passed here. Swap to "anthropic/claude-haiku-4-5" for faster/cheaper
// responses if tool-call accuracy isn't an issue during the demo.
const agent = new BuiltInAgent({
  model: "anthropic/claude-sonnet-4-6",
});

const runtime = new CopilotRuntime({
  agents: { default: agent },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
