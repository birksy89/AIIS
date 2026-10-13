import { deploys } from "./deploys";
import { knowledge } from "./knowledge";
import { logs } from "./logs";
import { metrics } from "./metrics";
import { serviceGraph } from "./service-graph";
import type { EvidenceRecord } from "./types";
import { waves } from "./waves";

export { deploys, knowledge, logs, metrics, serviceGraph, waves };
export { INCIDENT_TITLE } from "./waves";

export const INVESTIGATION_ID = "inc-checkout-2026-10-13";

const STATIC_AT = "2026-01-01T00:00:00Z";

/**
 * Every record the investigator could ever cite, keyed by id. Tool-backed records
 * become Evidence on the Investigation only once the agent has retrieved and cited them.
 */
export function scenarioCorpus(): Map<string, EvidenceRecord> {
  const records: EvidenceRecord[] = [
    ...waves.flatMap((wave) => wave.evidence),
    ...logs.map((line) => ({
      id: line.id,
      source: "log" as const,
      title: `${line.service} ${line.level}`,
      body: line.message,
      service: line.service,
      observedAt: line.at,
    })),
    ...metrics.map((series) => ({
      id: series.id,
      source: "metric" as const,
      title: series.description,
      body: `${series.metric} (${series.unit})`,
      service: series.service,
      observedAt: series.points[0].at,
    })),
    ...deploys.map((deploy) => ({
      id: deploy.id,
      source: "deploy" as const,
      title: `${deploy.service} ${deploy.version}`,
      body: `${deploy.notes} (by ${deploy.author} via ${deploy.pipeline})`,
      service: deploy.service,
      observedAt: deploy.at,
    })),
    ...serviceGraph.map((node) => ({
      id: node.id,
      source: "service" as const,
      title: `Service catalogue: ${node.name}`,
      body: `${node.notes} Depends on: ${node.dependsOn.map((d) => `${d.service} (${d.note})`).join("; ") || "none"}. Team ${node.team}, on-call ${node.onCall}.`,
      service: node.name,
      observedAt: STATIC_AT,
    })),
    ...knowledge.map((doc) => ({
      id: doc.id,
      source: doc.kind,
      title: doc.title,
      body: doc.body,
      service: null,
      observedAt: `${doc.date}T00:00:00Z`,
    })),
  ];
  return new Map(records.map((record) => [record.id, record]));
}
