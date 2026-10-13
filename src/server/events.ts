import { EventEmitter } from "node:events";

export type TraceEvent = {
  at: string;
  waveNumber: number;
  kind: "stage" | "tool" | "issue" | "error";
  name: string;
  detail: string;
  durationMs?: number;
};

export type InvestigationEvent =
  | { type: "trace"; event: TraceEvent }
  | { type: "revision"; waveNumber: number }
  | { type: "wave-started"; trigger: string }
  | { type: "busy"; busy: boolean };

const globalForEvents = globalThis as unknown as { investigationEvents?: EventEmitter };

const emitter = globalForEvents.investigationEvents ?? new EventEmitter();
emitter.setMaxListeners(50);
globalForEvents.investigationEvents = emitter;

export function publish(event: InvestigationEvent) {
  emitter.emit("event", event);
}

export function subscribe(listener: (event: InvestigationEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
