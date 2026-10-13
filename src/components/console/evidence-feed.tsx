"use client";

import {
  BellRing,
  BookOpen,
  ClipboardPaste,
  FileClock,
  GitCommitHorizontal,
  History,
  LineChart,
  Loader2,
  MessageSquare,
  Network,
  ScrollText,
  UserRound,
} from "lucide-react";
import { useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { EvidenceItem, Investigation } from "@/investigation/state";
import { currentClassification, observedLabel } from "@/investigation/state";
import { cn } from "@/lib/utils";
import type { InFlightWave } from "@/server/investigation-service";

import { ClassificationBadge, useCitations } from "./citations";
import { SOURCE_LABEL } from "./format";

const SOURCE_ICON: Record<EvidenceItem["source"], ComponentType<{ className?: string }>> = {
  alert: BellRing,
  chat: MessageSquare,
  log: ScrollText,
  metric: LineChart,
  deploy: GitCommitHorizontal,
  service: Network,
  runbook: BookOpen,
  incident: History,
  responder: UserRound,
  pasted: ClipboardPaste,
};

type Filter = "all" | "signal" | "noise";

export function EvidenceFeed({
  state,
  inFlight,
  busy,
  onAddEvidence,
}: {
  state: Investigation;
  inFlight: InFlightWave | null;
  busy: boolean;
  onAddEvidence: (text: string, title: string | null) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showRetrieved, setShowRetrieved] = useState(false);

  const items = Object.values(state.evidence)
    .filter((item) => showRetrieved || item.origin !== "retrieved")
    .filter((item) => {
      if (filter === "all") return true;
      return currentClassification(state, item.id)?.classification === filter;
    })
    .toSorted(
      (a, b) => b.waveNumber - a.waveNumber || Date.parse(b.observedAt) - Date.parse(a.observedAt),
    );

  const waves = [...new Set(items.map((item) => item.waveNumber))];
  const retrievedCount = Object.values(state.evidence).filter(
    (e) => e.origin === "retrieved",
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Evidence</h2>
        <div className="flex gap-1">
          {(["all", "signal", "noise"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded px-2 py-0.5 text-xs capitalize text-muted-foreground hover:text-foreground",
                filter === value && "bg-muted text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showRetrieved}
          onChange={(event) => setShowRetrieved(event.target.checked)}
        />
        Include {retrievedCount} records the investigator retrieved and cited
      </label>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {inFlight && (
            <section className="space-y-2">
              <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium tracking-wide text-sky-300 uppercase">
                <Loader2 className="size-3 animate-spin" />
                Wave {state.waveNumber + 1} · investigating
              </p>
              {inFlight.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-dashed border-sky-500/30 p-3"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{SOURCE_LABEL[item.source]}</span>
                    <span className="font-mono">{observedLabel(item, inFlight.clock)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-snug font-medium">{item.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </section>
          )}
          {items.length === 0 && !inFlight && (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              No Evidence yet. Deliver the first Wave to start the incident.
            </p>
          )}
          {waves.map((wave) => (
            <section key={wave} className="space-y-2">
              <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Wave {wave}
              </p>
              {items
                .filter((item) => item.waveNumber === wave)
                .map((item) => (
                  <EvidenceCard key={item.id} item={item} state={state} />
                ))}
            </section>
          ))}
        </div>
      </ScrollArea>
      <AddEvidence busy={busy} onAddEvidence={onAddEvidence} />
    </div>
  );
}

function EvidenceCard({ item, state }: { item: EvidenceItem; state: Investigation }) {
  const { open } = useCitations();
  const Icon = SOURCE_ICON[item.source];
  const history = state.classifications[item.id] ?? [];
  const current = history.at(-1) ?? null;
  const reclassified = history.length > 1;

  return (
    <button
      type="button"
      onClick={() => open(item.id)}
      className={cn(
        "w-full rounded-lg border bg-card/50 p-3 text-left transition-colors hover:bg-muted/40",
        current?.classification === "noise" && "opacity-60",
        current?.classification === "signal" && "border-amber-500/25",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
          <span>{SOURCE_LABEL[item.source]}</span>
          <span className="font-mono">{observedLabel(item, state.clock)}</span>
        </div>
        <ClassificationBadge classification={current?.classification ?? null} />
      </div>
      <p className="mt-1.5 text-sm leading-snug font-medium">{item.title}</p>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
      {current && (
        <p className="mt-2 text-xs leading-relaxed">
          {reclassified && (
            <span className="mr-1 inline-flex items-center gap-1 text-sky-300">
              <FileClock className="size-3" />
              was {history.at(-2)?.classification}, changed in Wave {current.waveNumber}:
            </span>
          )}
          <span className="text-foreground/80">{current.reason}</span>
        </p>
      )}
      <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/70">{item.id}</p>
    </button>
  );
}

function AddEvidence({
  busy,
  onAddEvidence,
}: {
  busy: boolean;
  onAddEvidence: (text: string, title: string | null) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    await onAddEvidence(text.trim(), null);
    setText("");
    setSending(false);
  };

  return (
    <div className="space-y-2 border-t p-3">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste a log excerpt, alert, or note. It becomes Evidence in its own Wave."
        className="min-h-16 resize-none text-xs"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Ctrl+Enter to add</span>
        <Button size="sm" variant="secondary" disabled={!text.trim() || sending} onClick={submit}>
          {busy ? "Queue as Wave" : "Add as Wave"}
        </Button>
      </div>
    </div>
  );
}
