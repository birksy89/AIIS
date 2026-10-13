import { PgVector } from "@mastra/pg";

import { requireEnv } from "./db";

export const MASTRA_SCHEMA = "mastra";

const globalForVector = globalThis as unknown as { knowledgeVector?: PgVector };

export const knowledgeVector =
  globalForVector.knowledgeVector ??
  new PgVector({
    id: "aiis-knowledge",
    connectionString: requireEnv("DATABASE_URL"),
    schemaName: MASTRA_SCHEMA,
  });

if (process.env.NODE_ENV !== "production") globalForVector.knowledgeVector = knowledgeVector;
