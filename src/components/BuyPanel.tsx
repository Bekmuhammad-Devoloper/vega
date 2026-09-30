"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRODUCTS,
  COUNTRIES,
  PREMIUM_PLANS,
  STAR_PACKS,
  USERNAME_RE,
  isGiftProduct,
  isStarsProduct,
} from "@/lib/catalog";
import { formatUzs } from "@/lib/format";

type BoardRow = { slug: string; price: number | null; count: number };

export function BuyPanel() {
  const router = useRouter();
  const [product, setProduct] = useState<string>(PRODUCTS[0].slug);
  const [country, setCountry] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [price, setPrice] = useState<{ available: boolean; price: number | null; count: number } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const gift = isGiftProduct(product);
  const stars = isStarsProduct(product);
  // Telegram raqam va Premium — LZT (tayyor akkaunt), qolganlari — SMS.
  const lztNumber = product === "telegram";
  const usernameOk = !stars || USERNAME_RE.test(username.trim());

  // Mahsulot almashganda — barcha davlatlar (muddatlar) narxini yuklaymiz.
  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setBoardLoading(true);
    fetch(`/api/catalog?product=${product}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setBoard(data.board ?? null);
      })
      .catch(() => {
        /* narxsiz ro'yxat ko'rsatiladi */
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product]);

  // Premium uchun davlat o'rniga muddat tanlanadi (bir xil `country` maydoni).
  // Narxlar bo'lsa — faqat mavjudlari, eng arzonidan boshlab.
  const variants = useMemo(() => {
    const base = gift
      ? PREMIUM_PLANS.map((p) => ({ slug: p.slug, flag: "⭐", name: p.name }))
      : stars
        ? STAR_PACKS.map((p) => ({ slug: p.slug, flag: "🌟", name: p.name }))
        : COUNTRIES
            // SMS xizmatlari (HeroSMS) faqat kodi bor davlatlarda.
            .filter((c) => lztNumber || c.hero)
            .map((c) => ({ slug: c.slug, flag: c.flag, name: c.name }));
    if (!board) return base.map((v) => ({ ...v, price: null as number | null }));
    const bySlug = new Map(board.map((r) => [r.slug, r]));
    return base
      .map((v) => {
        const r = bySlug.get(v.slug);
        return { ...v, price: r && r.count > 0 ? r.price : null };
      })
      .filter((v) => v.price != null)
      .sort((a, b) => (gift || stars ? 0 : a.price! - b.price!));
  }, [gift, stars, lztNumber, board]);

  const cheapest = !gift && !stars && board ? variants[0]?.slug : undefined;

  // Tanlangan yo'nalishning aniq (joriy) narxini yuklaymiz.
  useEffect(() => {
    if (!country) {
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

  function selectProduct(slug: string) {
    if (slug === product) return;
    // Raqam <-> gift almashganda eski tanlov boshqa ro'yxatga tegishli bo'ladi.
    setCountry(null);
    setProduct(slug);
  }

  async function buy() {
    if (!country || !usernameOk) return;
    setBuying(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, country, ...(stars ? { username: username.trim() } : {}) }),
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
      {/* 1-qadam: mahsulot */}
      <p className="mb-2 text-sm font-semibold text-[var(--muted)]">1. Mahsulot</p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {PRODUCTS.map((p) => (
          <button
            key={p.slug}
            onClick={() => selectProduct(p.slug)}
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

      {/* 2-qadam: davlat (Premium uchun — muddat) */}
      <p className="mb-2 flex items-center justify-between text-sm font-semibold text-[var(--muted)]">
        <span>{gift ? "2. Muddat" : stars ? "2. Miqdor" : "2. Davlat"}</span>
        {cheapest && (
          <span className="text-xs font-normal">Eng arzonidan boshlab</span>
        )}
      </p>
      {boardLoading && (
        <p className="mb-3 text-xs text-[var(--muted)]">Narxlar yuklanmoqda...</p>
      )}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {variants.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCountry(c.slug)}
            className={`relative flex flex-col items-start rounded-xl border px-3 py-2 text-left text-sm transition ${
              country === c.slug
                ? "border-[var(--brand)] bg-[var(--brand)]/15"
                : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]/50"
            }`}
          >
            <span className="flex w-full items-center gap-2">
              <span>{c.flag}</span>
              <span className="truncate">{c.name}</span>
            </span>
            {c.price != null && (
              <span className="mt-0.5 text-xs text-[var(--muted)]">{formatUzs(c.price)}</span>
            )}
            {c.slug === cheapest && (
              <span className="absolute -top-2 right-2 rounded-md bg-green-500/20 px-1.5 text-[10px] font-semibold text-green-300">
                ENG ARZON
              </span>
            )}
          </button>
        ))}
      </div>
      {board && variants.length === 0 && (
        <p className="mb-5 text-sm text-amber-400">Hozircha mavjud taklif yo&apos;q</p>
      )}

      {/* Stars oluvchisi */}
      {stars && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-[var(--muted)]">3. Kimga (Telegram username)</p>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            autoComplete="off"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
          />
          {username && !usernameOk && (
            <p className="mt-1 text-xs text-amber-400">Username noto&apos;g&apos;ri (masalan: @durov)</p>
          )}
        </div>
      )}

      {/* Narx + sotib olish */}
      {country && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-center">
          <div>
            {priceLoading && <span className="text-sm text-[var(--muted)]">Narx yuklanmoqda...</span>}
            {!priceLoading && price && price.available && (
              <>
                <div className="text-xl font-bold">{formatUzs(price.price!)}</div>
                <div className="text-xs text-[var(--muted)]">
                  {stars ? "Istalgan akkauntga yuboriladi" : `Mavjud: ${price.count} ta ${gift ? "havola" : "raqam"}`}
                </div>
              </>
            )}
            {!priceLoading && price && !price.available && (
              <span className="text-sm text-amber-400">Bu yo&apos;nalishda hozircha yo&apos;q</span>
            )}
          </div>
          <button
            onClick={buy}
            disabled={buying || priceLoading || !price?.available || !usernameOk}
            className="btn btn-primary w-full sm:w-auto"
          >
            {buying
              ? "Sotib olinmoqda..."
              : gift
                ? "Premium sotib olish"
                : stars
                  ? "Stars yuborish"
                  : "Raqam sotib olish"}
          </button>
        </div>
      )}

      {lztNumber && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Tayyor Telegram akkaunti beriladi: raqam bilan kirasiz, kirish kodi shu saytda
          chiqadi. Xarid qaytarilmaydi.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
