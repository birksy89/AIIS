import { inFlightWave, isBusy, scriptedProgress } from "@/server/investigation-service";
import { listRevisions, loadState } from "@/server/investigation-store";

export async function GET() {
  const [state, revisions, progress] = await Promise.all([
    loadState(),
    listRevisions(),
    scriptedProgress(),
  ]);
  return Response.json({ state, revisions, progress, busy: isBusy(), inFlight: inFlightWave() });
}
