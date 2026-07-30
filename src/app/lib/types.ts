export type ToolTrace = { name: string; input: Record<string, unknown>; output: unknown };

// One full round-trip to Claude within a single turn — a turn can involve
// several of these if Claude calls tools more than once before answering.
export type DebugStep = {
  stopReason: string;
  content: unknown[];
  toolCalls: { name: string; input: Record<string, unknown>; rawOutput: unknown; slimmedOutput: unknown }[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  trace?: ToolTrace[];
  model?: string | null;
  debug?: DebugStep[];
  cacheHit?: boolean;
};

// Anthropic-format message content, opaque to the UI — just round-tripped
// to the server on every turn.
export type ApiHistory = unknown[];

export type LiteProduct = {
  id: string;
  title: string;
  brand?: string;
  price: number;
  currency?: string;
  availability?: string;
  image_url?: string;
  purchase_url: string;
  offer_count?: number;
};

export type Offer = {
  id: string;
  source: string;
  price: number;
  purchase_url: string;
  image_url?: string;
};

// enabled: false keeps a model wired up end-to-end but off the public demo —
// flip it on once server-side spend/rate limiting is durable (see route.ts).
export const MODEL_OPTIONS = [
  { key: "haiku", label: "Haiku 4.5", tag: "Free", enabled: true },
  { key: "sonnet", label: "Sonnet 5", tag: "Smarter", enabled: false },
] as const;
