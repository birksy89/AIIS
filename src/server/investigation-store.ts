import type { Prisma } from "@/generated/prisma/client";
import type { Delta } from "@/investigation/delta";
import { emptyInvestigation, type Investigation } from "@/investigation/state";
import type { Issue } from "@/investigation/verify";
import { INCIDENT_TITLE, INVESTIGATION_ID } from "@/scenario";

import { db } from "./db";
import type { TraceEvent } from "./events";

export type RevisionSummary = {
  waveNumber: number;
  trigger: string;
  clock: string;
  waveNote: string;
  rejectedClaims: Issue[];
  trace: TraceEvent[];
};

export async function loadState(): Promise<Investigation> {
  const latest = await db.investigationRevision.findFirst({
    where: { investigationId: INVESTIGATION_ID },
    orderBy: { waveNumber: "desc" },
  });
  return latest
    ? (latest.state as unknown as Investigation)
    : emptyInvestigation(INVESTIGATION_ID, INCIDENT_TITLE);
}

export async function listRevisions(): Promise<RevisionSummary[]> {
  const rows = await db.investigationRevision.findMany({
    where: { investigationId: INVESTIGATION_ID },
    orderBy: { waveNumber: "asc" },
    select: {
      waveNumber: true,
      trigger: true,
      clock: true,
      delta: true,
      rejectedClaims: true,
      trace: true,
    },
  });
  return rows.map((row) => ({
    waveNumber: row.waveNumber,
    trigger: row.trigger,
    clock: row.clock.toISOString(),
    waveNote: (row.delta as unknown as Delta).waveNote,
    rejectedClaims: row.rejectedClaims as unknown as Issue[],
    trace: row.trace as unknown as TraceEvent[],
  }));
}

export async function scriptedWavesDelivered(): Promise<number> {
  return db.investigationRevision.count({
    where: { investigationId: INVESTIGATION_ID, trigger: { startsWith: "scripted" } },
  });
}

export async function persistRevision(input: {
  trigger: string;
  state: Investigation;
  delta: Delta;
  rejectedClaims: Issue[];
  trace: TraceEvent[];
}) {
  const { state } = input;
  if (!state.clock) throw new Error("Cannot persist a revision without a replay clock");
  const newEvidence = Object.values(state.evidence).filter(
    (item) => item.waveNumber === state.waveNumber,
  );
  await db.$transaction([
    db.evidence.createMany({
      data: newEvidence.map((item) => ({
        investigationId: INVESTIGATION_ID,
        id: item.id,
        source: item.source,
        title: item.title,
        body: item.body,
        service: item.service,
        observedAt: new Date(item.observedAt),
        waveNumber: item.waveNumber,
        origin: item.origin,
      })),
      skipDuplicates: true,
    }),
    db.investigationRevision.create({
      data: {
        investigationId: INVESTIGATION_ID,
        waveNumber: state.waveNumber,
        trigger: input.trigger,
        clock: new Date(state.clock),
        delta: toJson(input.delta),
        state: toJson(state),
        rejectedClaims: toJson(input.rejectedClaims),
        trace: toJson(input.trace),
      },
    }),
  ]);
}

export async function resetInvestigation() {
  await db.$transaction([
    db.investigationRevision.deleteMany({ where: { investigationId: INVESTIGATION_ID } }),
    db.evidence.deleteMany({ where: { investigationId: INVESTIGATION_ID } }),
  ]);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
