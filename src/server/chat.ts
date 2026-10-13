import { INVESTIGATION_ID } from "@/scenario";

export const CHAT_THREAD_ID = `${INVESTIGATION_ID}-responder-chat`;
export const CHAT_RESOURCE_ID = "responder";

export async function clearChat() {
  const { mastra } = await import("@/mastra");
  const memory = await mastra.getAgentById("responder-chat").getMemory();
  try {
    await memory?.deleteThread(CHAT_THREAD_ID);
  } catch {
    // no thread yet
  }
}
