export type EvidenceSource =
  | "alert"
  | "chat"
  | "log"
  | "metric"
  | "deploy"
  | "service"
  | "runbook"
  | "incident"
  | "responder"
  | "pasted";

export type EvidenceRecord = {
  id: string;
  source: EvidenceSource;
  title: string;
  body: string;
  service: string | null;
  observedAt: string;
};

export type ScenarioWave = {
  number: number;
  at: string;
  label: string;
  evidence: EvidenceRecord[];
};

export type LogLine = {
  id: string;
  service: string;
  at: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | "LOG";
  message: string;
};

export type MetricSeries = {
  id: string;
  service: string;
  metric: string;
  unit: string;
  description: string;
  points: { at: string; value: number }[];
};

export type Deploy = {
  id: string;
  service: string;
  version: string;
  at: string;
  author: string;
  pipeline: string;
  notes: string;
};

export type ServiceNode = {
  id: string;
  name: string;
  kind: "service" | "database" | "external" | "infrastructure";
  team: string;
  onCall: string;
  dependsOn: { service: string; note: string }[];
  notes: string;
};

export type KnowledgeDoc = {
  id: string;
  kind: "runbook" | "incident";
  title: string;
  date: string;
  body: string;
};
