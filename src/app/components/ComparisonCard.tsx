import { computeSavings } from "../lib/extract";
import { Offer } from "../lib/types";

// One hero card for the winner, not N equal cards — the point of a
// comparison is "here's the one to buy and why", not a row of identical
// outbound links that each just take you to a single retailer.
export function ComparisonCard({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;
  const [cheapest, ...rest] = offers;
  const savings = computeSavings(offers);

  return (
    <div className="mb-3 w-full max-w-sm rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          {cheapest.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cheapest.image_url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          ) : (
            <div className="h-full w-full rounded-lg bg-gray-100" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500">Cheapest at</p>
          <p className="truncate text-sm font-semibold text-gray-900">{cheapest.source}</p>
          <p className="text-xl font-bold text-green-700">£{cheapest.price.toFixed(2)}</p>
        </div>
      </div>

      {savings && (
        <p className="mt-2 text-xs font-semibold text-green-700">
          Save £{savings.amount.toFixed(2)} ({savings.percent}%) vs the next cheapest
        </p>
      )}

      <a
        href={cheapest.purchase_url}
        target="_blank"
        rel="noopener"
        className="mt-3 block rounded-lg bg-green-600 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-green-500"
      >
        Buy from {cheapest.source} →
      </a>

      {rest.length > 0 && (
        <div className="mt-3 border-t border-green-200 pt-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Also compared
          </p>
          <ul className="space-y-0.5 text-xs text-gray-500">
            {rest.map((o) => (
              <li key={o.id} className="flex justify-between gap-2">
                <a href={o.purchase_url} target="_blank" rel="noopener" className="truncate hover:underline">
                  {o.source}
                </a>
                <span className="shrink-0">£{o.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
