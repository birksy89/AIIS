"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Loader2, Square, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { CitedText } from "./citations";

const transport = new DefaultChatTransport<UIMessage>({
  api: "/api/chat",
  // Mastra memory holds the thread, so only the new message travels.
  prepareSendMessagesRequest: ({ messages }) => ({ body: { messages: messages.slice(-1) } }),
});

const SUGGESTIONS = [
  "Why do you think the deploy isn't the cause?",
  "What should I check next?",
  "FYI: the reporting job has been paused by Data Platform.",
];

export function ChatPane() {
  const { messages, sendMessage, setMessages, status, stop, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    void fetch("/api/chat")
      .then((response) => response.json())
      .then((history: UIMessage[]) => setMessages(history))
      .catch(() => {});
  }, [setMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {messages.length === 0 && (
            <div className="space-y-3 py-6 text-sm text-muted-foreground">
              <p>
                Ask about the Investigation, or tell the assistant something you know. Facts and
                corrections become Responder Notes, which start a new Wave.
              </p>
              <div className="flex flex-col gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-md border px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          {status === "submitted" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Thinking…
            </p>
          )}
          {error && <p className="text-xs text-rose-300">Chat failed: {error.message}</p>}
          <div ref={bottom} />
        </div>
      </ScrollArea>
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask, or share what you know…"
          className="max-h-32 min-h-10 resize-none text-sm"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
        />
        {busy ? (
          <Button type="button" size="icon" variant="secondary" onClick={() => void stop()}>
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <ArrowUp />
          </Button>
        )}
      </form>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  const user = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-1.5", user && "items-end")}>
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return (
            <div
              key={index}
              className={cn(
                "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                user ? "bg-primary text-primary-foreground" : "bg-muted/60",
              )}
            >
              {user ? part.text : <CitedText text={part.text} />}
            </div>
          );
        }
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
          const tool = part as { type: string; toolName?: string; state?: string; input?: unknown };
          const name = tool.toolName ?? tool.type.replace(/^tool-/, "");
          const noted = name === "recordResponderNote";
          return (
            <p
              key={index}
              className={cn(
                "flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground",
                noted && "text-sky-300",
              )}
            >
              <Wrench className="size-3" />
              {noted ? "Recorded a Responder Note; a new Wave is starting" : name}
              {tool.state !== "output-available" && tool.state !== "output-error" && (
                <Loader2 className="size-3 animate-spin" />
              )}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
