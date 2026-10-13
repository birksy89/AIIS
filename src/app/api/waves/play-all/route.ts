import { inBackground } from "@/server/background";
import { deliverNextScriptedWave, scriptedProgress } from "@/server/investigation-service";

export const maxDuration = 800;

export async function POST() {
  const progress = await scriptedProgress();
  const remaining = progress.total - progress.delivered;
  if (remaining <= 0) {
    return Response.json(
      { accepted: false, reason: "All scripted Waves delivered" },
      { status: 409 },
    );
  }
  inBackground("waves/play-all", async () => {
    for (let i = 0; i < remaining; i++) {
      if (!(await deliverNextScriptedWave())) break;
    }
  });
  return Response.json({ accepted: true, remaining }, { status: 202 });
}
