import { NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MCP_URL = process.env.TRUSTRAILS_MCP_URL || "https://trustrails.app/api/mcp";
const MAX_TOOL_ITERATIONS = 5;

// Approximate per-token cost in USD — confirm against the current rate on
// console.anthropic.com before trusting these for real budgeting, they're
// only precise enough to catch a runaway spike, not for invoicing.
const MODELS: Record<string, { id: string; label: string; free: boolean; inputCost: number; outputCost: number }> = {
  haiku: {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    free: true,
    inputCost: 1 / 1_000_000,
    outputCost: 5 / 1_000_000,
  },
  sonnet: {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    free: false,
    inputCost: 3 / 1_000_000,
    outputCost: 15 / 1_000_000,
  },
};
const DEFAULT_MODEL_KEY = "haiku";
const DAILY_SPEND_CEILING_USD = 5;

function resolveModel(key: unknown): { key: string; config: (typeof MODELS)[string] } {
  const modelKey = typeof key === "string" && key in MODELS ? key : DEFAULT_MODEL_KEY;
  return { key: modelKey, config: MODELS[modelKey] };
}

const SYSTEM_PROMPT =
  "You are the live TrustRails agent demo. You have real tools connected to the public " +
  "TrustRails MCP server (search_products, get_product), backed by real UK electronics " +
  "pricing data across multiple retailers — laptops, phones, monitors, headphones, TVs, " +
  "and similar categories. It is NOT a general or novelty-goods catalogue. " +
  "When multiple retailers offer the same product, state the cheapest price and the " +
  "savings versus the others explicitly, using the real numbers from the tool results. " +
  "Be concise, plain, and factual. Never invent a price, retailer, or product that didn't " +
  "come from a tool result. This also means never speculating about what kinds of products " +
  "MIGHT be in the catalogue before you've actually searched — do not list example item " +
  "types, brands, or categories as possibilities unless a tool result confirmed them. If a " +
  "request is ambiguous or plausibly outside UK electronics, search first with your best " +
  "interpretation; only if that returns nothing should you say so plainly and ask a " +
  "clarifying question, without guessing at what else might exist.";

// ---- Bot filtering: only real, submitted user turns should ever reach the LLM ----

const BOT_UA_PATTERN = /bot|crawl|spider|scrape|curl|wget|python-requests|headless|axios/i;

function looksLikeBot(req: Request): boolean {
  const ua = req.headers.get("user-agent") || "";
  return ua === "" || BOT_UA_PATTERN.test(ua);
}

// ---- Rate limiting + spend ceiling (in-memory, best-effort per instance) ----

const ipHits = new Map<string, number[]>();
const IP_LIMIT = 20;
const IP_WINDOW_MS = 60 * 60 * 1000;

let dailySpendUsd = 0;
let dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;

function resetDailyWindowIfNeeded() {
  if (Date.now() > dailyResetAt) {
    dailySpendUsd = 0;
    dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;
  }
}

function ipRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  if (hits.length >= IP_LIMIT) return true;
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

function recordSpend(
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
  model: (typeof MODELS)[string]
) {
  if (!usage) return 0;
  const cost = (usage.input_tokens || 0) * model.inputCost + (usage.output_tokens || 0) * model.outputCost;
  dailySpendUsd += cost;
  return cost;
}

// ---- MCP client (calls the live public trustrails.app MCP server — free) ----

let toolsCache: { tools: unknown[]; fetchedAt: number } | null = null;
const TOOLS_CACHE_TTL = 10 * 60 * 1000;

async function mcpRequest(method: string, params?: Record<string, unknown>) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`MCP error: ${body.error.message}`);
  return body.result;
}

async function getTools() {
  if (toolsCache && Date.now() - toolsCache.fetchedAt < TOOLS_CACHE_TTL) {
    return toolsCache.tools;
  }
  const result = await mcpRequest("tools/list");
  type McpTool = { name: string; description: string; inputSchema: unknown };
  const tools = (result.tools as McpTool[]).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
  toolsCache = { tools, fetchedAt: Date.now() };
  return tools;
}

// The MCP tool description *asks* the calling model to set lite=true and a
// sane limit, but nothing enforces that server-side. Clamp here so a model
// that ignores the instruction can't drag full product objects (specs,
// descriptions) into context — the UI never shows more than 8 cards anyway.
function clampSearchArgs(args: Record<string, unknown>): Record<string, unknown> {
  return {
    ...args,
    lite: true,
    limit: Math.min(typeof args.limit === "number" ? args.limit : 8, 8),
  };
}

async function callTool(name: string, args: Record<string, unknown>) {
  const finalArgs = name === "search_products" ? clampSearchArgs(args) : args;
  const result = await mcpRequest("tools/call", { name, arguments: finalArgs });
  const text = result.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Strips fields the model never needs to *write* an answer (image/purchase
// URLs are long and only used by the UI, which reads them from `trace`, not
// from the model's own context). This is the fix for "product data going
// into the LLM": the model still decides what to call, but the payload it
// has to read back is a fraction of the size of what the UI renders.
function slimForModel(toolName: string, output: unknown): unknown {
  const o = output as Record<string, unknown> | null;
  if (!o) return output;

  if (toolName === "search_products" && Array.isArray(o.products)) {
    return {
      total: o.total,
      products: o.products.map((p: Record<string, unknown>) => ({
        id: p.id,
        title: p.title,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        availability: p.availability,
        offer_count: p.offer_count,
      })),
    };
  }

  if (toolName === "get_product") {
    const offers = Array.isArray(o.offers)
      ? o.offers.map((of: Record<string, unknown>) => ({
          source: of.source,
          price: of.price,
          currency: of.currency,
          availability: of.availability,
          delivery_time: of.delivery_time,
        }))
      : undefined;
    return {
      id: o.id,
      title: o.title,
      brand: o.brand,
      price: o.price,
      currency: o.currency,
      availability: o.availability,
      specs: o.specs,
      offers,
    };
  }

  return output;
}

// ---- Anthropic tool-calling loop ----

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

async function callClaude(messages: Message[], tools: unknown[], modelId: string) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }
  return res.json();
}

// ---- Fresh-query cache: identical/near-identical first questions are the ----
// ---- overwhelmingly common case for a shopping demo, so this alone kills ----
// ---- most repeat LLM cost. Only applied to turn 1 of a conversation —    ----
// ---- follow-ups depend on prior context and aren't worth caching.        ----

type CacheEntry = { reply: string; trace: Trace; history: Message[]; debugSteps: unknown; cachedAt: number };
type Trace = { name: string; input: Record<string, unknown>; output: unknown }[];

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // prices move; keep this short

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[£$]/g, "")
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function getCached(key: string): CacheEntry | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }
  return entry;
}

// ---- No-LLM fallback: used when a caller has hit the rate limit or the ----
// ---- daily spend ceiling. Still useful, costs nothing.                 ----

async function deterministicFallback(userMessage: string) {
  const result = await mcpRequest("tools/call", {
    name: "search_products",
    arguments: { query: userMessage, lite: true, limit: 8, sort: "relevance" },
  });
  const text = result.content?.[0]?.text ?? "{}";
  const output = JSON.parse(text);
  const trace: Trace = [{ name: "search_products", input: { query: userMessage }, output }];
  const count = Array.isArray(output.products) ? output.products.length : 0;
  return {
    reply:
      count > 0
        ? `Demo's AI-parsed answers are at their free limit right now, but here's a plain search match for "${userMessage}" — ${count} result${count === 1 ? "" : "s"} below.`
        : `Demo's AI-parsed answers are at their free limit right now, and a plain search for "${userMessage}" didn't find a match — try different terms.`,
    trace,
  };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  let body: { message?: string; history?: Message[]; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (userMessage.length > 500) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  if (looksLikeBot(req)) {
    return NextResponse.json({ error: "Not available to automated clients." }, { status: 403 });
  }

  const { key: modelKey, config: model } = resolveModel(body.model);

  const isFreshQuery = !body.history || body.history.length === 0;
  const cacheKey = isFreshQuery ? `${modelKey}::${normalizeQuery(userMessage)}` : null;

  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[agent] cache hit | ip=${ip} | model=${modelKey} | query="${userMessage}"`);
      return NextResponse.json({
        reply: cached.reply,
        trace: cached.trace,
        history: cached.history,
        debug: cached.debugSteps,
        model: modelKey,
        cacheHit: true,
      });
    }
  }

  resetDailyWindowIfNeeded();
  const overCeiling = dailySpendUsd >= DAILY_SPEND_CEILING_USD;
  const overIpLimit = ipRateLimited(ip);

  if (overCeiling || overIpLimit) {
    console.log(
      `[agent] degraded (no LLM) | ip=${ip} | reason=${overCeiling ? "daily_ceiling" : "ip_limit"} | query="${userMessage}"`
    );
    const fallback = await deterministicFallback(userMessage);
    return NextResponse.json({ ...fallback, history: [], degraded: true, model: null });
  }

  const messages: Message[] = [...(body.history || []), { role: "user", content: userMessage }];
  const trace: Trace = [];
  // TEMP DEBUG — full record of each round-trip to Claude this turn, sent to
  // the browser so the flow can be inspected on screen. Remove once done.
  const debugSteps: {
    stopReason: string;
    content: ContentBlock[];
    toolCalls: { name: string; input: Record<string, unknown>; rawOutput: unknown; slimmedOutput: unknown }[];
  }[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const tools = await getTools();

    let finalText = "";
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await callClaude(messages, tools, model.id);
      totalInputTokens += response.usage?.input_tokens || 0;
      totalOutputTokens += response.usage?.output_tokens || 0;

      const content: ContentBlock[] = response.content;
      const step: (typeof debugSteps)[number] = { stopReason: response.stop_reason, content, toolCalls: [] };

      messages.push({ role: "assistant", content });

      const toolUses = content.filter(
        (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
      );

      if (toolUses.length === 0) {
        finalText = content
          .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        debugSteps.push(step);
        break;
      }

      const toolResults: ContentBlock[] = [];
      for (const use of toolUses) {
        const output = await callTool(use.name, use.input);
        trace.push({ name: use.name, input: use.input, output });

        const slimmed = slimForModel(use.name, output);
        step.toolCalls.push({ name: use.name, input: use.input, rawOutput: output, slimmedOutput: slimmed });

        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(slimmed),
        });
      }
      debugSteps.push(step);
      messages.push({ role: "user", content: toolResults });
    }

    const cost = recordSpend({ input_tokens: totalInputTokens, output_tokens: totalOutputTokens }, model);
    console.log(
      `[agent] llm call | ip=${ip} | model=${modelKey} | in=${totalInputTokens} out=${totalOutputTokens} ` +
        `est_cost=$${cost.toFixed(5)} daily_spend=$${dailySpendUsd.toFixed(4)} query="${userMessage}"`
    );

    const reply = finalText || "I wasn't able to finish that lookup — try rephrasing the question.";

    if (cacheKey) {
      queryCache.set(cacheKey, { reply, trace, history: messages, debugSteps, cachedAt: Date.now() });
    }

    return NextResponse.json({ reply, trace, history: messages, debug: debugSteps, model: modelKey });
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json({ error: "Something went wrong on the agent side." }, { status: 500 });
  }
}
