import { summarizeTool } from "../lib/extract";
import { ToolTrace } from "../lib/types";

export function TraceSummary({ trace }: { trace: ToolTrace[] }) {
  return (
    <div className="mb-2 space-y-1">
      {trace.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <span className="text-blue-500 dark:text-blue-400">→</span>
          {summarizeTool(t)}
        </div>
      ))}
    </div>
  );
}
