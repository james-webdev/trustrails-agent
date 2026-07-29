"use client";

// TEMP DEBUG COMPONENT — for understanding the question-in/LLM/UI flow.
// Delete this file (and its usage in Chat.tsx) once done.

import { useState } from "react";

const STEPS = [
  {
    title: "1. You ask a question",
    detail: "The React app (this page) sends your text to our own server, at /api/chat.",
  },
  {
    title: "2. Our server asks Claude, with tools attached",
    detail:
      "We send Claude your question plus two tool definitions (search_products, get_product), pulled live from trustrails.app's public MCP server. Claude hasn't seen any product data yet.",
  },
  {
    title: "3. Claude decides to call a tool",
    detail:
      "Instead of answering directly, Claude replies with a tool_use request, e.g. \"call search_products with category: Monitors\".",
  },
  {
    title: "4. We actually run it, against the real API",
    detail:
      "Our server calls the live, public trustrails.app/api/mcp endpoint, the same one any external AI agent would use. Real data comes back.",
  },
  {
    title: "5. We trim it before Claude sees it",
    detail:
      "Image URLs and purchase links get stripped out of what Claude reads (it doesn't need them to write a sentence). The full untouched data is kept separately, for the UI.",
  },
  {
    title: "6. Claude writes the final answer",
    detail: "Using only the trimmed data it was handed back, Claude writes the reply you read.",
  },
  {
    title: "7. Both come back to the browser",
    detail:
      "We send Claude's written answer AND the original, untrimmed tool data back to this page in one response.",
  },
  {
    title: "8. The UI builds cards from the data, not the words",
    detail:
      "Product cards and the \"cheapest retailer\" card are built directly from that raw tool data, independent of what Claude's text says, so they're always accurate even if the wording is loose.",
  },
];

export function FlowExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          How this works: question in → Claude → back out
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && (
        <ol className="space-y-3 px-4 pb-4">
          {STEPS.map((s) => (
            <li key={s.title} className="text-xs">
              <p className="font-semibold text-gray-700 dark:text-gray-300">{s.title}</p>
              <p className="text-gray-500 dark:text-gray-500">{s.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
