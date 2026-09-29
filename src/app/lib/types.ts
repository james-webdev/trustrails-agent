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

// Structured specs read from retailer titles. confirmed: two or more retailers
// state the same value. inferred: one retailer does. conflicting: retailers
// state different values, and none is picked. A spec nobody states is absent
// (unknown). Optional on Product: the API only sends it once trustrails#21 is
// deployed and the catalogue refilled.
export type AttributeSource = { retailer: string; field: "title" };
export type Attribute =
  | { status: "confirmed" | "inferred"; value: number; sources: AttributeSource[] }
  | { status: "conflicting"; values: { value: number; sources: AttributeSource[] }[] };
export type Attributes = Record<string, Attribute>;

// Per spec constraint in a search; only present when the search had constraints.
export type ConstraintStatus = Record<string, "matched" | "unverified" | "failed">;

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
  attributes?: Attributes;
  constraint_status?: ConstraintStatus;
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
