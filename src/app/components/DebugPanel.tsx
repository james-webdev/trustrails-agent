"use client";

// TEMP DEBUG COMPONENT — for understanding the question-in/LLM/UI flow.
// Delete this file (and its usage in Chat.tsx) once done.

import { useState } from "react";
import { DebugStep } from "../lib/types";

function Json({ data }: { data: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-lg bg-black/90 p-3 text-[11px] leading-relaxed text-green-400">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function DebugPanel({ steps, cacheHit }: { steps?: DebugStep[]; cacheHit?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-3 mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        {open ? "▲ Hide flow for this answer" : "▼ Show flow for this answer"}
        {cacheHit && <span className="ml-1 italic">(served from cache, no Claude call this time)</span>}
      </button>

      {open && (
        <div className="mt-2 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          {steps.map((step, i) => (
            <div key={i} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                Round trip {i + 1} to Claude — stop reason: {step.stopReason}
              </p>

              <div>
                <p className="mb-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  What Claude sent back (raw)
                </p>
                <Json data={step.content} />
              </div>

              {step.toolCalls.map((call, j) => (
                <div key={j} className="space-y-2 border-l-2 border-blue-200 pl-3 dark:border-blue-900">
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    Tool call: <span className="font-mono text-gray-700 dark:text-gray-300">{call.name}</span>(
                    {JSON.stringify(call.input)})
                  </p>
                  <div>
                    <p className="mb-1 text-[11px] text-gray-400 dark:text-gray-500">
                      Raw response from the live MCP server
                    </p>
                    <Json data={call.rawOutput} />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-gray-400 dark:text-gray-500">
                      Trimmed version actually sent back into Claude&apos;s context
                    </p>
                    <Json data={call.slimmedOutput} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
