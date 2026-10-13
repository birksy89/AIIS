import type { WaveLogEntry } from "@/investigation/export";

import type { RevisionSummary } from "./investigation-store";

export function waveLog(revisions: RevisionSummary[]): WaveLogEntry[] {
  return revisions.map((revision) => ({
    waveNumber: revision.waveNumber,
    trigger: revision.trigger,
    clock: revision.clock,
    waveNote: revision.waveNote,
    toolCalls: revision.trace.filter(
      (event) => event.kind === "tool" || event.name === "searchKnowledge",
    ).length,
    rejectedClaims: revision.rejectedClaims.length,
  }));
}
