import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import type { PgVector } from "@mastra/pg";
import { embed, embedMany } from "ai";

import { knowledge } from "@/scenario";
import type { KnowledgeDoc } from "@/scenario/types";

import { requireEnv } from "./db";

export const KNOWLEDGE_INDEX = "knowledge";
export const EMBEDDING_DIMENSION = 1536;

function embedder() {
  return new ModelRouterEmbeddingModel({
    providerId: "openrouter",
    modelId: process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
    url: "https://openrouter.ai/api/v1",
    apiKey: requireEnv("OPENROUTER_API_KEY"),
  });
}

function documentText(doc: KnowledgeDoc) {
  return `${doc.title}\n\n${doc.body}`;
}

export async function seedKnowledge(vector: PgVector) {
  const indexes = await vector.listIndexes();
  if (indexes.includes(KNOWLEDGE_INDEX)) await vector.deleteIndex({ indexName: KNOWLEDGE_INDEX });
  await vector.createIndex({
    indexName: KNOWLEDGE_INDEX,
    dimension: EMBEDDING_DIMENSION,
    metric: "cosine",
  });
  const { embeddings } = await embedMany({
    model: embedder(),
    values: knowledge.map(documentText),
  });
  await vector.upsert({
    indexName: KNOWLEDGE_INDEX,
    vectors: embeddings,
    ids: knowledge.map((doc) => doc.id),
    metadata: knowledge.map((doc) => ({ id: doc.id, kind: doc.kind, title: doc.title })),
  });
  return knowledge.length;
}

export type KnowledgeHit = {
  id: string;
  kind: KnowledgeDoc["kind"];
  title: string;
  date: string;
  body: string;
  score: number;
};

export type KnowledgeSearch = {
  mode: "semantic" | "keyword-fallback";
  degradedReason: string | null;
  hits: KnowledgeHit[];
};

export async function searchKnowledge(
  vector: PgVector,
  query: string,
  kind: KnowledgeDoc["kind"] | null,
  topK = 3,
): Promise<KnowledgeSearch> {
  try {
    const { embedding } = await embed({ model: embedder(), value: query });
    const results = await vector.query({
      indexName: KNOWLEDGE_INDEX,
      queryVector: embedding,
      topK,
      filter: kind ? { kind } : undefined,
    });
    const hits = results.flatMap((result) => {
      const doc = knowledge.find((d) => d.id === result.id);
      return doc ? [{ ...doc, score: round(result.score) }] : [];
    });
    return { mode: "semantic", degradedReason: null, hits };
  } catch (error) {
    return {
      mode: "keyword-fallback",
      degradedReason: error instanceof Error ? error.message : String(error),
      hits: keywordSearch(query, kind, topK),
    };
  }
}

export function keywordSearch(
  query: string,
  kind: KnowledgeDoc["kind"] | null,
  topK: number,
): KnowledgeHit[] {
  const terms = tokens(query);
  return knowledge
    .filter((doc) => !kind || doc.kind === kind)
    .map((doc) => {
      const docTerms = new Set(tokens(documentText(doc)));
      const overlap = terms.filter((t) => docTerms.has(t)).length;
      return { ...doc, score: terms.length ? round(overlap / terms.length) : 0 };
    })
    .filter((hit) => hit.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, topK);
}

function tokens(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 2);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
