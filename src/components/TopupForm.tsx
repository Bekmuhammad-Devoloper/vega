"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUzs } from "@/lib/format";

export function TopupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik");
      setMsg(`${data.email} balansi: ${formatUzs(data.balance)}`);
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <input
        className="input"
        type="email"
        placeholder="Foydalanuvchi email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="input sm:max-w-[180px]"
        type="number"
        min="1"
        placeholder="Summa (so'm)"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button type="submit" className="btn btn-primary whitespace-nowrap" disabled={loading}>
        {loading ? "..." : "To'ldirish"}
      </button>
      {msg && <p className="self-center text-sm text-green-400">{msg}</p>}
      {error && <p className="self-center text-sm text-red-400">{error}</p>}
    </form>
  );
}
