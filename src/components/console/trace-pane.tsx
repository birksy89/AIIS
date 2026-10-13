"use client";

import { AlertTriangle, CircleDot, Wrench, XCircle } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TraceEvent } from "@/server/events";
import type { RevisionSummary } from "@/server/investigation-store";

import { hhmm } from "./format";

const KIND_ICON = { stage: CircleDot, tool: Wrench, issue: AlertTriangle, error: XCircle };

export function TracePane({
  revisions,
  liveTrace,
}: {
  revisions: RevisionSummary[];
  liveTrace: TraceEvent[];
}) {
  const stored = new Set(revisions.map((revision) => revision.waveNumber));
  const inFlight = liveTrace.filter((event) => !stored.has(event.waveNumber));
  const inFlightWaves = [...new Set(inFlight.map((event) => event.waveNumber))];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        {revisions.length === 0 && inFlight.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            The agent trace shows every stage, tool call and verifier decision for each Wave.
          </p>
        )}
        {inFlightWaves.map((wave) => (
          <TraceGroup
            key={`live-${wave}`}
            title={wave === 0 ? "System" : `Wave ${wave} · in progress`}
            events={inFlight.filter((event) => event.waveNumber === wave)}
            live
          />
        ))}
        {revisions.toReversed().map((revision) => (
          <TraceGroup
            key={revision.waveNumber}
            title={`Wave ${revision.waveNumber} · ${revision.trigger} · ${hhmm(revision.clock)}`}
            events={revision.trace}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function TraceGroup({
  title,
  events,
  live,
}: {
  title: string;
  events: TraceEvent[];
  live?: boolean;
}) {
  const tools = events.filter((event) => event.kind === "tool").length;
  return (
    <section className="space-y-1.5">
      <p className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {live && <span className="size-1.5 animate-pulse rounded-full bg-sky-400" />}
        {title}
        <span className="normal-case">({tools} tool calls)</span>
      </p>
      <ol className="space-y-1">
        {events.map((event, index) => {
          const Icon = KIND_ICON[event.kind];
          return (
            <li key={index} className="flex gap-2 text-xs leading-relaxed">
              <Icon
                className={cn(
                  "mt-0.5 size-3 shrink-0 text-muted-foreground",
                  event.kind === "tool" && "text-sky-300",
                  event.kind === "issue" && "text-amber-400",
                  event.kind === "error" && "text-rose-400",
                )}
              />
              <span className="min-w-0">
                <span className="font-mono text-foreground/90">{event.name}</span>{" "}
                <span className="break-words text-muted-foreground">{event.detail}</span>
                {event.durationMs ? (
                  <span className="ml-1 font-mono text-muted-foreground/60">
                    {(event.durationMs / 1000).toFixed(1)}s
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
