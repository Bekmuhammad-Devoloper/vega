import Link from "next/link";
import { formatUzs, formatDate, statusLabel } from "@/lib/format";
import { productBySlug, countryBySlug } from "@/lib/catalog";
import type { OrderDTO } from "@/lib/types";

const colorMap: Record<string, string> = {
  amber: "bg-amber-500/15 text-amber-300",
  green: "bg-green-500/15 text-green-300",
  gray: "bg-gray-500/15 text-gray-300",
  red: "bg-red-500/15 text-red-300",
};

export function OrderRow({ order }: { order: OrderDTO }) {
  const product = productBySlug(order.product);
  const country = countryBySlug(order.country);
  const status = statusLabel(order.status);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--brand)]/50"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{product?.emoji ?? "📱"}</span>
        <div>
          <div className="font-semibold">
            {product?.name ?? order.product}{" "}
            <span className="text-[var(--muted)]">· {country?.flag ?? ""} {country?.name ?? order.country}</span>
          </div>
          <div className="font-mono text-sm text-[var(--muted)]">{order.phone}</div>
        </div>
      </div>
      <div className="text-right">
        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${colorMap[status.color]}`}>
          {status.text}
        </span>
        <div className="mt-1 text-xs text-[var(--muted)]">
          {formatUzs(order.price)} · {formatDate(order.createdAt)}
        </div>
      </div>
    </Link>
  );
}
