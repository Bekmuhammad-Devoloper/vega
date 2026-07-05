"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatUzs, formatDate } from "@/lib/format";

interface Payment {
  id: string;
  amount: number;
  method: string;
  createdAt: string;
  user: { email: string };
}

export function PendingPayments() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/payments")
      .then((r) => r.json())
      .then((d) => setPayments(d.payments || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      await fetch(`/api/admin/payments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setPayments((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (payments.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Kutilayotgan to&apos;lovlar yo&apos;q.</p>;
  }

  return (
    <div className="space-y-2">
      {payments.map((p) => (
        <div
          key={p.id}
          className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="font-semibold">
              {p.user.email} — {formatUzs(p.amount)}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {p.method} · {formatDate(p.createdAt)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => act(p.id, "approve")}
              disabled={busy === p.id}
              className="btn btn-primary !py-1.5 text-sm"
            >
              Tasdiqlash
            </button>
            <button
              onClick={() => act(p.id, "reject")}
              disabled={busy === p.id}
              className="btn btn-ghost !py-1.5 text-sm"
            >
              Rad etish
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
