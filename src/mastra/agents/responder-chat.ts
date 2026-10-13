import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { loadState } from "@/server/investigation-store";

import { hhmm, renderInvestigation } from "../prompts";
import { investigationTools } from "../tools/investigation-tools";
import { recordResponderNoteTool } from "../tools/record-responder-note";

const RESPONDER_CHAT_INSTRUCTIONS = `You are the investigation assistant talking with the incident responder. You can see the current Investigation below and you can query the same time-gated tools as the investigator.

- Answer briefly and directly. Lead with the answer, then the evidence.
- Ground every factual claim in Evidence and cite ids in square brackets, e.g. [log-ordersdb-04]. If the Investigation or tools do not show it, say you do not know.
- You cannot edit the Investigation. When the responder states a fact, reports an action they took, or confirms or rejects a Hypothesis, call recordResponderNote so it becomes Evidence for the next Wave, then tell them you did.
- Do not call recordResponderNote for questions or speculation.
- When asked for a stakeholder update or handover notes, write them from the current Investigation.`;

export const responderChatAgent = new Agent({
  id: "responder-chat",
  name: "Responder chat",
  instructions: async () => {
    const state = await loadState();
    return `${RESPONDER_CHAT_INSTRUCTIONS}

## Current Investigation (Wave ${state.waveNumber}, replay clock ${hhmm(state.clock)} UTC)
${renderInvestigation(state)}`;
  },
  model: process.env.CHAT_MODEL ?? "openrouter/anthropic/claude-sonnet-5.5",
  tools: { ...investigationTools, recordResponderNote: recordResponderNoteTool },
  memory: new Memory({ options: { lastMessages: 20 } }),
});
