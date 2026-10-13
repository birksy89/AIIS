"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  currentClassification,
  isReference,
  observedLabel,
  type Investigation,
} from "@/investigation/state";
import { cn } from "@/lib/utils";

import { SOURCE_LABEL } from "./format";

type CitationContextValue = { state: Investigation; open: (id: string) => void };

const CitationContext = createContext<CitationContextValue | null>(null);

export function CitationProvider({
  state,
  children,
}: {
  state: Investigation;
  children: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const item = openId ? state.evidence[openId] : null;
  const history = openId ? (state.classifications[openId] ?? []) : [];

  return (
    <CitationContext.Provider value={{ state, open: setOpenId }}>
      {children}
      <Dialog open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{openId}</DialogTitle>
            <DialogDescription>
              {item
                ? `${SOURCE_LABEL[item.source]}${item.service ? ` · ${item.service}` : ""} · ${isReference(item) ? "reference" : `observed ${observedLabel(item, state.clock)} UTC`} · ${item.origin} in Wave ${item.waveNumber}`
                : "This id is not on the Investigation yet. It may have been seen by the chat assistant but not cited by the investigator."}
            </DialogDescription>
          </DialogHeader>
          {item && (
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium">{item.title}</p>
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {item.body}
                </pre>
              </div>
              {history.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Classification history
                  </p>
                  {history.map((entry) => (
                    <p key={entry.waveNumber} className="text-sm">
                      <span className="text-muted-foreground">Wave {entry.waveNumber}:</span>{" "}
                      <ClassificationBadge classification={entry.classification} /> {entry.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CitationContext.Provider>
  );
}

export function useCitations() {
  const context = useContext(CitationContext);
  if (!context) throw new Error("useCitations must be used inside CitationProvider");
  return context;
}

export function CitationChip({
  id,
  tone = "neutral",
}: {
  id: string;
  tone?: "neutral" | "support" | "contradict";
}) {
  const { state, open } = useCitations();
  const known = Boolean(state.evidence[id]);
  return (
    <button
      type="button"
      onClick={() => open(id)}
      title={state.evidence[id]?.title ?? id}
      className={cn(
        "inline-flex max-w-full items-center rounded border px-1.5 py-px font-mono text-[11px] leading-4 transition-colors hover:bg-muted",
        tone === "support" && "border-emerald-500/40 text-emerald-300",
        tone === "contradict" && "border-rose-500/40 text-rose-300",
        tone === "neutral" && "border-border text-muted-foreground",
        !known && "border-dashed",
      )}
    >
      <span className="truncate">{id}</span>
    </button>
  );
}

export function CitationList({
  ids,
  tone,
}: {
  ids: string[];
  tone?: "neutral" | "support" | "contradict";
}) {
  if (ids.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map((id) => (
        <CitationChip key={id} id={id} tone={tone} />
      ))}
    </span>
  );
}

export function ClassificationBadge({
  classification,
}: {
  classification: "signal" | "noise" | null;
}) {
  if (!classification) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        unclassified
      </Badge>
    );
  }
  return classification === "signal" ? (
    <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-300">Signal</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Noise
    </Badge>
  );
}

const INLINE_PATTERN = /\[([a-z][a-z0-9-]*(?:,\s*[a-z][a-z0-9-]*)*)\]|\*\*([^*]+)\*\*|`([^`]+)`/g;

/** Renders model text: [evidence-id] references become chips; **bold** and `code` are honoured. */
export function CitedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    parts.push(text.slice(last, index));
    const [, ids, bold, code] = match;
    if (ids) {
      for (const id of ids.split(/,\s*/))
        parts.push(<CitationChip key={`${index}-${id}`} id={id} />);
    } else if (bold) {
      parts.push(<strong key={index}>{bold}</strong>);
    } else {
      parts.push(
        <code key={index} className="rounded bg-muted px-1 font-mono text-[0.85em]">
          {code}
        </code>,
      );
    }
    last = index + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

export function useClassification(id: string) {
  const { state } = useCitations();
  return currentClassification(state, id);
}
