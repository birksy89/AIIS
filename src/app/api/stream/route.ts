import { subscribe, type InvestigationEvent } from "@/server/events";

const HEARTBEAT_MS = 15_000;

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup?.();
        try {
          controller.close();
        } catch {
          // The consumer may already have canceled the stream.
        }
      };
      const send = (event: InvestigationEvent | { type: "ping" }) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          close();
        }
      };
      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", close);
      send({ type: "ping" });
    },
    cancel() {
      closed = true;
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
