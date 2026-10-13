"use client";

import { Download, FastForward, Loader2, RotateCcw, SkipForward } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Brief } from "./brief";
import { ChatPane } from "./chat-pane";
import { CitationProvider } from "./citations";
import { EvidenceFeed } from "./evidence-feed";
import { hhmm } from "./format";
import { TracePane } from "./trace-pane";
import { useInvestigation } from "./use-investigation";

export function InvestigationConsole() {
  const investigation = useInvestigation();
  const { snapshot, busy, error, liveTrace } = investigation;
  const [confirmReset, setConfirmReset] = useState(false);
  const [chatEpoch, setChatEpoch] = useState(0);

  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        {error ? (
          <span className="text-rose-300">{error}. Is Postgres running (pnpm db:up)?</span>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin" /> Loading Investigation…
          </>
        )}
      </div>
    );
  }

  const { state, revisions, progress } = snapshot;
  const finished = progress.delivered >= progress.total;
  const currentStep = liveTrace.findLast(
    (event) => event.kind === "stage" || event.kind === "tool",
  );

  return (
    <CitationProvider state={state}>
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-4 border-b px-4 py-2.5">
          <div className="shrink-0">
            <h1 className="truncate text-sm font-semibold">{state.title}</h1>
            <p className="text-xs text-muted-foreground">
              Replay clock{" "}
              <span className="font-mono text-foreground">{hhmm(state.clock)} UTC</span> · Wave{" "}
              {state.waveNumber} · scripted {progress.delivered}/{progress.total}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {busy && (
              <Badge
                variant="outline"
                className="max-w-full min-w-0 justify-start gap-1.5 text-sky-300"
              >
                <Loader2 className="size-3 shrink-0 animate-spin" />
                <span className="truncate">
                  {currentStep ? `${currentStep.name}: ${currentStep.detail}` : "Investigating…"}
                </span>
              </Badge>
            )}
            {error && <span className="truncate text-xs text-rose-300">{error}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              disabled={finished || busy}
              onClick={() => void investigation.nextWave()}
            >
              <SkipForward /> Next wave
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={finished || busy}
              onClick={() => void investigation.playAll()}
            >
              <FastForward /> Play all
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/api/export">
                <Download /> Export
              </a>
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>
              <RotateCcw /> Reset
            </Button>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(420px,1fr)_360px] overflow-x-auto 2xl:grid-cols-[360px_minmax(520px,1fr)_420px]">
          <aside className="min-h-0 border-r">
            <EvidenceFeed
              state={state}
              inFlight={snapshot.inFlight}
              busy={busy}
              onAddEvidence={investigation.addEvidence}
            />
          </aside>
          <section className="min-h-0">
            <Brief state={state} revisions={revisions} />
          </section>
          <aside className="min-h-0 border-l">
            <Tabs defaultValue="chat" className="flex h-full flex-col gap-0">
              <TabsList className="m-2 self-start">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="trace">Agent trace</TabsTrigger>
              </TabsList>
              <TabsContent value="chat" className="min-h-0 flex-1">
                <ChatPane key={chatEpoch} />
              </TabsContent>
              <TabsContent value="trace" className="min-h-0 flex-1">
                <TracePane revisions={revisions} liveTrace={liveTrace} />
              </TabsContent>
            </Tabs>
          </aside>
        </main>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the Investigation?</DialogTitle>
            <DialogDescription>
              This deletes every revision, all Evidence and the chat thread, and restarts the replay
              from Wave 1.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setConfirmReset(false);
                await investigation.reset();
                setChatEpoch((epoch) => epoch + 1);
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CitationProvider>
  );
}
