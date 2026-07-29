import { LiteProduct } from "../lib/types";

// Product cards stay light in both themes (Amazon/eBay approach): retailer
// photos have baked-in white backgrounds, so a white card absorbs them
// seamlessly instead of leaving an odd pale patch inside a dark card.
export function ProductCard({ p }: { p: LiteProduct }) {
  return (
    <a
      href={p.purchase_url}
      target="_blank"
      rel="noopener"
      className="flex w-44 shrink-0 flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
    >
      <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-white">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <div className="h-full w-full rounded-lg bg-gray-100" />
        )}
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-snug text-gray-900">{p.title}</p>
      <p className="mt-1 text-lg font-bold text-blue-600">£{p.price.toFixed(2)}</p>
      {p.offer_count != null && p.offer_count > 1 && (
        <p className="text-[11px] text-gray-400">{p.offer_count} retailers</p>
      )}
    </a>
  );
}

export function ProductRow({ products }: { products: LiteProduct[] }) {
  if (products.length === 0) return null;
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pt-2 pb-2">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}
