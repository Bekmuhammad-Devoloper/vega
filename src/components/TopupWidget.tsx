"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUzs } from "@/lib/format";

interface Method {
  id: string;
  name: string;
  description: string;
  instant: boolean;
}

const QUICK = [5000, 10000, 25000, 50000, 100000];

export function TopupWidget() {
  const router = useRouter();
  const [methods, setMethods] = useState<Method[]>([]);
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/payments/methods")
      .then((r) => r.json())
      .then((d) => {
        setMethods(d.methods || []);
        if (d.methods?.[0]) setMethod(d.methods[0].id);
      })
      .catch(() => setError("Usullarni yuklashda xatolik"));
  }, []);

  async function submit() {
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik");
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setMsg(data.message || "Bajarildi");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tez summalar */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => setAmount(q)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              amount === q
                ? "border-[var(--brand)] bg-[var(--brand)]/15"
                : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]/50"
            }`}
          >
            {formatUzs(q)}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">Summa (so&apos;m)</label>
        <input
          type="number"
          className="input"
          min={1000}
          step={1000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>

      {/* To'lov usuli */}
      <div>
        <label className="mb-1 block text-sm text-[var(--muted)]">To&apos;lov usuli</label>
        <div className="space-y-2">
          {methods.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                method === m.id
                  ? "border-[var(--brand)] bg-[var(--brand)]/15"
                  : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]/50"
              }`}
            >
              <div>
                <div className="font-semibold">{m.name}</div>
                <div className="text-xs text-[var(--muted)]">{m.description}</div>
              </div>
              {m.instant && (
                <span className="rounded-lg bg-green-500/15 px-2 py-1 text-xs text-green-300">
                  darhol
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={loading || !method || amount < 1000}
        className="btn btn-primary w-full"
      >
        {loading ? "..." : `${formatUzs(amount)} to'ldirish`}
      </button>

      {msg && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{msg}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
