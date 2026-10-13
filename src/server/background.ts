import { after } from "next/server";

import { publish } from "./events";

/** Wave processing takes tens of seconds; respond immediately and report progress over SSE. */
export function inBackground(label: string, work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work();
    } catch (error) {
      publish({
        type: "trace",
        event: {
          at: new Date().toISOString(),
          waveNumber: 0,
          kind: "error",
          name: label,
          detail: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
}
