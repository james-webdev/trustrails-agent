"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { ComparisonCard } from "./components/ComparisonCard";
import { DebugPanel } from "./components/DebugPanel";
import { ProductRow } from "./components/ProductCard";
import { Prose } from "./components/Prose";
import { ThemeToggle } from "./components/ThemeToggle";
import { TraceSummary } from "./components/TraceSummary";
import { extractOffers, extractProducts } from "./lib/extract";
import { ApiHistory, ChatMessage, MODEL_OPTIONS } from "./lib/types";

const SUGGESTIONS = [
  "Compare prices on the AOC 27 inch monitor",
  "Compare prices for the Beats Studio Pro",
  "Any gaming laptops under £900?",
  "Compare prices on the ASUS wireless mouse",
  "Compare prices on the Fairphone charger",
  "Show me Samsung TVs",
  "Which retailer has the best price on the AirPods Pro?",
];

const enabledModels = MODEL_OPTIONS.filter((opt) => opt.enabled);

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(true);
  const [model, setModel] = useState<string>(enabledModels[0].key);
  const apiHistory = useRef<ApiHistory>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  function clearChat() {
    setMessages([]);
    setError(null);
    apiHistory.current = [];
  }

  function toggleDark() {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {
        // private browsing etc. — toggle still works for this page view
      }
      return next;
    });
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: apiHistory.current, model }),
      });
      const data = await res.json();
      // TEMP DEBUG — remove once the question-in / LLM / UI flow is understood.
      console.log("[debug] full API response received by the UI:", data);
      if (!res.ok) throw new Error(data.error || "Request failed");
      apiHistory.current = data.history || [];
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          text: data.reply,
          trace: data.trace,
          model: data.model,
          debug: data.debug,
          cacheHit: data.cacheHit,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      <header className="hero-glow relative pt-4 pb-8 text-center">
        <div className="mb-4 flex items-center justify-end gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Clear chat
            </button>
          )}
          <ThemeToggle dark={dark} onToggle={toggleDark} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          Live agent demo
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Ask TrustRails</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          A real AI agent, calling the public{" "}
          <a
            href="https://trustrails.app/mcp"
            target="_blank"
            rel="noopener"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            TrustRails MCP server
          </a>{" "}
          over the network, live, for every answer below.
        </p>
        {enabledModels.length > 1 && (
          <div className="mt-4 inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
            {enabledModels.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setModel(opt.key)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                  (model === opt.key
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100")
                }
              >
                {opt.label} <span className="opacity-70">· {opt.tag}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-6 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => {
          const offers = m.role === "assistant" && m.trace ? extractOffers(m.trace) : [];
          const products = m.role === "assistant" && m.trace ? extractProducts(m.trace) : [];
          return (
            <div key={i} className={"message-in " + (m.role === "user" ? "text-right" : "text-left")}>
              {m.role === "assistant" && m.trace && m.trace.length > 0 && <TraceSummary trace={m.trace} />}
              <ComparisonCard offers={offers} />
              {offers.length === 0 && <ProductRow products={products} />}
              {m.role === "user" ? (
                <div className="inline-block max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-white">
                  {m.text}
                </div>
              ) : (
                <>
                  <Prose text={m.text} />
                  {m.model && (
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-600">
                      {MODEL_OPTIONS.find((o) => o.key === m.model)?.label ?? m.model}
                    </p>
                  )}
                  <DebugPanel steps={m.debug} cacheHit={m.cacheHit} />
                </>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="text-left text-sm text-gray-400 dark:text-gray-500">
            <span className="animate-pulse">Calling the live API…</span>
          </div>
        )}

        {error && <div className="text-center text-sm text-red-500 dark:text-red-400">{error}</div>}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 flex items-end gap-2 border-t border-gray-200 bg-white/90 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about any UK electronics product or price…"
          rows={1}
          className="max-h-40 flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600 dark:focus:border-blue-600"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
