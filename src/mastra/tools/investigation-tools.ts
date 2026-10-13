import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getMetrics, getServiceContext, listDeploys, queryLogs } from "@/scenario/query";
import { searchKnowledge } from "@/server/knowledge";
import { knowledgeVector } from "@/server/vector";

import { runFrom } from "../run-context";

const timeHint = "HH:MM (UTC, incident day) or ISO timestamp; null for no bound";

export const queryLogsTool = createTool({
  id: "queryLogs",
  description:
    "Search raw service logs up to the current replay clock. Services: checkout-api, inventory-service, reporting-worker, orders-db, edge-gateway. Returns at most 25 lines (latest first window); narrow with service/pattern/time if truncated. Each line has an id you can cite.",
  inputSchema: z.object({
    service: z.string().nullable().describe("Service name, or null for all services"),
    pattern: z.string().nullable().describe("Case-insensitive substring, e.g. 'too many clients'"),
    level: z.string().nullable().describe("INFO, WARN, ERROR, FATAL or LOG; null for any level"),
    since: z.string().nullable().describe(timeHint),
    until: z.string().nullable().describe(timeHint),
  }),
  execute: async (input, context) => {
    const run = runFrom(context?.requestContext);
    const started = Date.now();
    const result = queryLogs(input, run.clock);
    run.remember(result.lines.map((line) => line.id));
    run.record({
      kind: "tool",
      name: "queryLogs",
      detail: `${describe(input)} → ${result.totalMatches} lines${result.truncated ? " (truncated)" : ""}`,
      durationMs: Date.now() - started,
    });
    return result;
  },
});

export const getMetricsTool = createTool({
  id: "getMetrics",
  description:
    "Fetch metric time series for a service up to the replay clock, with min/max/latest. Series id is citable.",
  inputSchema: z.object({
    service: z
      .string()
      .describe("e.g. checkout-api, orders-db, reporting-worker, payments-gateway"),
    metric: z.string().nullable().describe("Metric name, or null for every series of the service"),
  }),
  execute: async (input, context) => {
    const run = runFrom(context?.requestContext);
    const started = Date.now();
    const result = getMetrics(input, run.clock);
    run.remember(result.series.map((s) => s.id));
    run.record({
      kind: "tool",
      name: "getMetrics",
      detail: `${describe(input)} → ${result.series.map((s) => s.metric).join(", ") || "no series"}`,
      durationMs: Date.now() - started,
    });
    return result;
  },
});

export const listDeploysTool = createTool({
  id: "listDeploys",
  description:
    "List deploys from the argo-cd deploy history up to the replay clock. Changes shipped through other pipelines do not appear here. Each deploy id is citable.",
  inputSchema: z.object({
    service: z.string().nullable().describe("Service name, or null for every service"),
    since: z.string().nullable().describe(timeHint),
  }),
  execute: async (input, context) => {
    const run = runFrom(context?.requestContext);
    const started = Date.now();
    const result = listDeploys(input, run.clock);
    run.remember(result.deploys.map((d) => d.id));
    run.record({
      kind: "tool",
      name: "listDeploys",
      detail: `${describe(input)} → ${result.deploys.map((d) => `${d.service} ${d.version}`).join(", ") || "none"}`,
      durationMs: Date.now() - started,
    });
    return result;
  },
});

export const getServiceContextTool = createTool({
  id: "getServiceContext",
  description:
    "Look up a service in the service catalogue: owner, on-call, dependencies (with intended usage notes) and dependents. Use it to trace blast radius and shared dependencies. The svc- ids are citable.",
  inputSchema: z.object({ service: z.string() }),
  execute: async (input, context) => {
    const run = runFrom(context?.requestContext);
    const started = Date.now();
    const result = getServiceContext(input.service);
    if (result.found) run.remember([result.node.id, ...result.dependents.map((d) => d.id)]);
    run.record({
      kind: "tool",
      name: "getServiceContext",
      detail: result.found
        ? `${input.service} → depends on ${result.node.dependsOn.map((d) => d.service).join(", ") || "nothing"}; dependents ${result.dependents.map((d) => d.service).join(", ") || "none"}`
        : `${input.service} → not in catalogue`,
      durationMs: Date.now() - started,
    });
    return result;
  },
});

export const searchKnowledgeTool = createTool({
  id: "searchKnowledge",
  description:
    "Semantic search over runbooks and prior incident reports. Prior incidents can look similar but have different causes: compare their signals with this one before relying on them. kb- ids are citable.",
  inputSchema: z.object({
    query: z.string().describe("Describe the symptom or question in plain words"),
    kind: z.enum(["runbook", "incident"]).nullable(),
  }),
  execute: async (input, context) => {
    const run = runFrom(context?.requestContext);
    const started = Date.now();
    const result = await searchKnowledge(knowledgeVector, input.query, input.kind);
    run.remember(result.hits.map((hit) => hit.id));
    run.record({
      kind: result.mode === "semantic" ? "tool" : "issue",
      name: "searchKnowledge",
      detail: `"${input.query}" → ${result.hits.map((h) => `${h.id} (${h.score})`).join(", ") || "no hits"}${result.degradedReason ? ` [vector search unavailable, used keyword fallback: ${result.degradedReason.slice(0, 120)}]` : ""}`,
      durationMs: Date.now() - started,
    });
    return result;
  },
});

export const investigationTools = {
  queryLogs: queryLogsTool,
  getMetrics: getMetricsTool,
  listDeploys: listDeploysTool,
  getServiceContext: getServiceContextTool,
  searchKnowledge: searchKnowledgeTool,
};

function describe(input: Record<string, unknown>) {
  return Object.entries(input)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}
