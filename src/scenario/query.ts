import { deploys } from "./deploys";
import { logs } from "./logs";
import { metrics } from "./metrics";
import { serviceGraph } from "./service-graph";
import { INCIDENT_DATE, isVisible } from "./time";
import type { Deploy, LogLine, MetricSeries, ServiceNode } from "./types";

export const LOG_LIMIT = 25;

function toInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return Date.parse(`${INCIDENT_DATE}T${value.length === 5 ? `${value}:00` : value}Z`);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export type LogQuery = {
  service: string | null;
  pattern: string | null;
  level: string | null;
  since: string | null;
  until: string | null;
};

export function queryLogs(query: LogQuery, clock: string | null) {
  const since = toInstant(query.since);
  const until = toInstant(query.until);
  const needle = query.pattern?.toLowerCase() ?? null;
  const matched = logs.filter((line: LogLine) => {
    if (!isVisible(line.at, clock)) return false;
    if (query.service && line.service !== query.service) return false;
    if (query.level && line.level !== query.level.toUpperCase()) return false;
    if (since !== null && Date.parse(line.at) < since) return false;
    if (until !== null && Date.parse(line.at) > until) return false;
    if (needle && !line.message.toLowerCase().includes(needle)) return false;
    return true;
  });
  return {
    totalMatches: matched.length,
    truncated: matched.length > LOG_LIMIT,
    lines: matched.slice(-LOG_LIMIT),
  };
}

export function getMetrics(
  query: { service: string; metric: string | null },
  clock: string | null,
) {
  const series = metrics
    .filter((s: MetricSeries) => s.service === query.service)
    .filter((s) => !query.metric || s.metric === query.metric)
    .map((s) => {
      const visible = s.points.filter((p) => isVisible(p.at, clock));
      const values = visible.map((p) => p.value);
      return {
        id: s.id,
        service: s.service,
        metric: s.metric,
        unit: s.unit,
        description: s.description,
        points: visible,
        stats: values.length
          ? {
              min: Math.min(...values),
              max: Math.max(...values),
              latest: values.at(-1) ?? null,
            }
          : null,
      };
    })
    .filter((s) => s.points.length > 0);
  return {
    series,
    availableMetrics: metrics.map((s) => `${s.service}:${s.metric}`),
  };
}

export function listDeploys(
  query: { service: string | null; since: string | null },
  clock: string | null,
) {
  const since = toInstant(query.since);
  return {
    deploys: deploys.filter((d: Deploy) => {
      if (!isVisible(d.at, clock)) return false;
      if (query.service && d.service !== query.service) return false;
      if (since !== null && Date.parse(d.at) < since) return false;
      return true;
    }),
  };
}

export function getServiceContext(service: string) {
  const node = serviceGraph.find((s: ServiceNode) => s.name === service);
  if (!node) {
    return { found: false as const, knownServices: serviceGraph.map((s) => s.name) };
  }
  const dependents = serviceGraph
    .filter((s) => s.dependsOn.some((d) => d.service === service))
    .map((s) => ({
      id: s.id,
      service: s.name,
      note: s.dependsOn.find((d) => d.service === service)?.note ?? "",
    }));
  return { found: true as const, node, dependents };
}
