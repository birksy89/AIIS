import { handleChatStream } from "@mastra/ai-sdk";
import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { createUIMessageStreamResponse } from "ai";

import { mastra } from "@/mastra";
import { InvestigationRun } from "@/mastra/run-context";
import { CHAT_RESOURCE_ID, CHAT_THREAD_ID } from "@/server/chat";
import { loadState } from "@/server/investigation-store";

export const maxDuration = 120;

export async function POST(request: Request) {
  const params = await request.json();
  const state = await loadState();
  const run = new InvestigationRun(state.clock, state.waveNumber);
  const stream = await handleChatStream({
    mastra,
    agentId: "responder-chat",
    version: "v7",
    params: {
      ...params,
      maxSteps: 8,
      requestContext: run.toRequestContext(),
      memory: { thread: CHAT_THREAD_ID, resource: CHAT_RESOURCE_ID },
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function GET() {
  const memory = await mastra.getAgentById("responder-chat").getMemory();
  try {
    const response = await memory?.recall({
      threadId: CHAT_THREAD_ID,
      resourceId: CHAT_RESOURCE_ID,
    });
    return Response.json(toAISdkMessages(response?.messages ?? [], { version: "v7" }));
  } catch {
    return Response.json([]);
  }
}
