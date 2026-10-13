import { toMarkdown } from "@/investigation/export";
import { listRevisions, loadState } from "@/server/investigation-store";
import { waveLog } from "@/server/wave-log";

export async function GET() {
  const [state, revisions] = await Promise.all([loadState(), listRevisions()]);
  const markdown = toMarkdown(state, waveLog(revisions));
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${state.id}-wave-${state.waveNumber}.md"`,
    },
  });
}
