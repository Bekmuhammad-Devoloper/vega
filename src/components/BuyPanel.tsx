"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCTS, COUNTRIES } from "@/lib/catalog";
import { formatUzs } from "@/lib/format";

export function BuyPanel() {
  const router = useRouter();
  const [product, setProduct] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [price, setPrice] = useState<{ available: boolean; price: number | null; count: number } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  // Xizmat + davlat tanlanganda narxni yuklaymiz.
  useEffect(() => {
    if (!product || !country) {
      setPrice(null);
      return;
    }
    let cancelled = false;
    setPriceLoading(true);
    setPrice(null);
    setError("");
    fetch(`/api/prices?product=${product}&country=${country}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPrice(data);
      })
      .catch(() => {
        if (!cancelled) setError("Narxni olishda xatolik");
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product, country]);

  async function buy() {
    if (!product || !country) return;
    setBuying(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik");
      router.push(`/orders/${data.order.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="card p-5">
      {/* 1-qadam: xizmat */}
      <p className="mb-2 text-sm font-semibold text-[var(--muted)]">1. Xizmat</p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {PRODUCTS.map((p) => (
          <button
            key={p.slug}
            onClick={() => setProduct(p.slug)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
              product === p.slug
                ? "border-[var(--brand)] bg-[var(--brand)]/15"
                : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]/50"
            }`}
          >
            <span>{p.emoji}</span>
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>

      {/* 2-qadam: davlat */}
      <p className="mb-2 text-sm font-semibold text-[var(--muted)]">2. Davlat</p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {COUNTRIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCountry(c.slug)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
              country === c.slug
                ? "border-[var(--brand)] bg-[var(--brand)]/15"
                : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]/50"
            }`}
          >
            <span>{c.flag}</span>
            <span className="truncate">{c.name}</span>
          </button>
        ))}
      </div>

      {/* Narx + sotib olish */}
      {product && country && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-center">
          <div>
            {priceLoading && <span className="text-sm text-[var(--muted)]">Narx yuklanmoqda...</span>}
            {!priceLoading && price && price.available && (
              <>
                <div className="text-xl font-bold">{formatUzs(price.price!)}</div>
                <div className="text-xs text-[var(--muted)]">Mavjud: {price.count} ta raqam</div>
              </>
            )}
            {!priceLoading && price && !price.available && (
              <span className="text-sm text-amber-400">Bu yo&apos;nalishda raqam yo&apos;q</span>
            )}
          </div>
          <button
            onClick={buy}
            disabled={buying || priceLoading || !price?.available}
            className="btn btn-primary w-full sm:w-auto"
          >
            {buying ? "Sotib olinmoqda..." : "Raqam sotib olish"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
