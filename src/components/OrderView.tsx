"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { productBySlug, countryBySlug } from "@/lib/catalog";
import { formatUzs, statusLabel } from "@/lib/format";
import type { OrderDTO } from "@/lib/types";

const TERMINAL = ["RECEIVED", "FINISHED", "CANCELED", "TIMEOUT", "BANNED"];

function Countdown({ expiresAt }: { expiresAt: string | null }) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className="font-mono">
      {mm}:{ss}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="btn btn-ghost !px-3 !py-1.5 text-sm"
    >
      {copied ? "✓ Nusxa olindi" : "Nusxa olish"}
    </button>
  );
}

export function OrderView({ initial }: { initial: OrderDTO }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDTO>(initial);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const product = productBySlug(order.product);
  const country = countryBySlug(order.country);
  const status = statusLabel(order.status);
  const isPending = order.status === "PENDING";

  // PENDING bo'lsa har 3 soniyada SMS'ni tekshiramiz.
  useEffect(() => {
    if (TERMINAL.includes(order.status)) return;
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        const data = await res.json();
        if (res.ok && data.order) {
          setOrder(data.order);
          if (TERMINAL.includes(data.order.status) && timer.current) {
            clearInterval(timer.current);
          }
        }
      } catch {
        /* jimgina qayta urinamiz */
      }
    }, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [order.id, order.status]);

  async function cancel() {
    setCanceling(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik");
      setOrder(data.order);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setCanceling(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <button onClick={() => router.push("/")} className="text-sm text-[var(--muted)] hover:text-white">
        ← Orqaga
      </button>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{product?.emoji ?? "📱"}</span>
            <div>
              <div className="text-lg font-bold">{product?.name ?? order.product}</div>
              <div className="text-sm text-[var(--muted)]">
                {country?.flag} {country?.name ?? order.country}
              </div>
            </div>
          </div>
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              status.color === "green"
                ? "bg-green-500/15 text-green-300"
                : status.color === "amber"
                  ? "bg-amber-500/15 text-amber-300"
                  : status.color === "red"
                    ? "bg-red-500/15 text-red-300"
                    : "bg-gray-500/15 text-gray-300"
            }`}
          >
            {status.text}
          </span>
        </div>

        {/* Telefon raqami */}
        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="mb-1 text-xs text-[var(--muted)]">Telefon raqami</div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xl font-bold tracking-wide">{order.phone}</span>
            <CopyButton value={order.phone} />
          </div>
        </div>

        {/* SMS kodi yoki kutish */}
        {order.smsCode ? (
          <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="mb-1 text-xs text-green-300">✓ SMS kodi keldi</div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-3xl font-bold tracking-widest text-green-300">
                {order.smsCode}
              </span>
              <CopyButton value={order.smsCode} />
            </div>
            {order.smsText && (
              <p className="mt-2 text-xs text-[var(--muted)]">{order.smsText}</p>
            )}
          </div>
        ) : isPending ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <span className="text-sm text-amber-300">
                SMS kutilmoqda... Raqamni kiriting va kodni shu yerda kuting.
              </span>
            </div>
            {order.expiresAt && (
              <span className="whitespace-nowrap text-sm text-amber-300">
                ⏳ <Countdown expiresAt={order.expiresAt} />
              </span>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>Narx: {formatUzs(order.price)}</span>
          {isPending && (
            <button onClick={cancel} disabled={canceling} className="btn btn-ghost !py-1.5 text-sm">
              {canceling ? "..." : "Bekor qilish (pul qaytadi)"}
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
