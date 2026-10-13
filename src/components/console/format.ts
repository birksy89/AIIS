import type { Confidence, EvidenceItem, HypothesisStatus } from "@/investigation/state";

export function hhmm(iso: string | null | undefined): string {
  return iso ? iso.slice(11, 16) : "--:--";
}

export const SOURCE_LABEL: Record<EvidenceItem["source"], string> = {
  alert: "Alert",
  chat: "Chat",
  log: "Log",
  metric: "Metric",
  deploy: "Deploy",
  service: "Catalogue",
  runbook: "Runbook",
  incident: "Prior incident",
  responder: "Responder Note",
  pasted: "Pasted",
};

export const STATUS_STYLE: Record<HypothesisStatus, string> = {
  supported: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  open: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  refuted: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30 line-through decoration-zinc-500",
};

export const CONFIDENCE_LEVEL: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

export const CONFIDENCE_STYLE: Record<Confidence, string> = {
  low: "bg-zinc-500",
  medium: "bg-amber-400",
  high: "bg-emerald-400",
};
