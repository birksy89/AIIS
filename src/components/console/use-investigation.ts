"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Investigation } from "@/investigation/state";
import type { InvestigationEvent, TraceEvent } from "@/server/events";
import type { InFlightWave } from "@/server/investigation-service";
import type { RevisionSummary } from "@/server/investigation-store";

export type InvestigationSnapshot = {
  state: Investigation;
  revisions: RevisionSummary[];
  progress: { delivered: number; total: number };
  busy: boolean;
  inFlight: InFlightWave | null;
};

export function useInvestigation() {
  const [snapshot, setSnapshot] = useState<InvestigationSnapshot | null>(null);
  const [liveTrace, setLiveTrace] = useState<TraceEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const response = await fetch("/api/investigation", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load investigation (${response.status})`);
      const next = (await response.json()) as InvestigationSnapshot;
      setSnapshot(next);
      setBusy(next.busy);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const source = new EventSource("/api/stream");
    source.addEventListener("message", (message) => {
      const event = JSON.parse(message.data) as InvestigationEvent | { type: "ping" };
      if (event.type === "trace") {
        setLiveTrace((trace) => [...trace.slice(-199), event.event]);
        if (event.event.kind === "error" && event.event.waveNumber === 0) {
          setError(event.event.detail);
        }
      } else if (event.type === "busy") {
        setBusy(event.busy);
        if (!event.busy) void refresh();
      } else if (event.type === "wave-started") {
        void refresh();
      } else if (event.type === "revision") {
        if (event.waveNumber === 0) setLiveTrace([]);
        void refresh();
      }
    });
    return () => source.close();
  }, [refresh]);

  const post = useCallback(
    async (path: string, body?: unknown) => {
      setError(null);
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok && response.status !== 409) {
        const detail = await response.json().catch(() => ({}));
        setError((detail as { error?: string }).error ?? `Request failed (${response.status})`);
      }
      if (response.status === 202) setBusy(true);
      await refresh();
    },
    [refresh],
  );

  return {
    snapshot,
    liveTrace,
    busy,
    error,
    nextWave: () => post("/api/waves/next"),
    playAll: () => post("/api/waves/play-all"),
    reset: () => post("/api/reset"),
    addEvidence: (text: string, title: string | null) => post("/api/evidence", { text, title }),
  };
}
