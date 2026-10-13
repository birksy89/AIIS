import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

import { requireEnv } from "@/server/db";
import { knowledgeVector, MASTRA_SCHEMA } from "@/server/vector";

import { investigatorAgent } from "./agents/investigator";
import { responderChatAgent } from "./agents/responder-chat";
import { processWave } from "./workflows/process-wave";

function createMastra() {
  return new Mastra({
    agents: { investigator: investigatorAgent, responderChat: responderChatAgent },
    workflows: { processWave },
    storage: new PostgresStore({
      id: "aiis-storage",
      connectionString: requireEnv("DATABASE_URL"),
      schemaName: MASTRA_SCHEMA,
    }),
    vectors: { knowledge: knowledgeVector },
  });
}

const globalForMastra = globalThis as unknown as { mastra?: ReturnType<typeof createMastra> };

export const mastra = globalForMastra.mastra ?? createMastra();

if (process.env.NODE_ENV !== "production") globalForMastra.mastra = mastra;
