import { Offer, ToolTrace } from "./types";

export function isOffer(v: unknown): v is Offer {
  const o = v as Partial<Offer> | null;
  return (
    !!o &&
    typeof o.id === "string" &&
    typeof o.source === "string" &&
    typeof o.price === "number" &&
    typeof o.purchase_url === "string"
  );
}

export function extractOffers(trace: ToolTrace[]): Offer[] {
  for (const t of trace) {
    const output = t.output as Record<string, unknown> | null;
    const offers = output?.offers;
    if (Array.isArray(offers) && offers.every(isOffer) && offers.length > 1) {
      return [...offers].sort((a, b) => a.price - b.price);
    }
  }
  return [];
}

// Same formula as trustrails-compare's price-gap cards: savings against the
// *next* cheapest offer, not the most expensive — "beats the nearest
// competitor", which is the number that actually means something to a buyer.
export function computeSavings(offers: Offer[]): { amount: number; percent: number } | null {
  if (offers.length < 2) return null;
  const amount = offers[1].price - offers[0].price;
  if (amount <= 0) return null;
  return { amount, percent: Math.round((amount / offers[1].price) * 100) };
}

export function summarizeTool(t: ToolTrace): string {
  if (t.name === "search_products") {
    const { brand, category, query, min_price, max_price, sort } = t.input as Record<string, unknown>;
    const parts: string[] = [];
    if (brand) parts.push(String(brand));
    if (category) parts.push(String(category));
    if (query) parts.push(`"${query}"`);
    if (min_price != null || max_price != null) {
      parts.push(`£${min_price ?? 0}–£${max_price ?? "∞"}`);
    }
    const label = parts.length ? parts.join(" · ") : "all products";
    const sorted = sort === "price_asc" ? ", cheapest first" : sort === "price_desc" ? ", priciest first" : "";
    return `Searched ${label}${sorted}`;
  }
  if (t.name === "get_product") return "Looked up full product details";
  return t.name;
}
