"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card p-6">
        <h1 className="mb-1 text-2xl font-bold">
          {mode === "login" ? "Tizimga kirish" : "Ro'yxatdan o'tish"}
        </h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Virtual raqamlar xizmatiga xush kelibsiz
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              className="input"
              placeholder="Ismingiz (ixtiyoriy)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="input"
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Parol"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="mt-4 w-full text-center text-sm text-[var(--muted)] hover:text-white"
        >
          {mode === "login"
            ? "Hisobingiz yo'qmi? Ro'yxatdan o'ting"
            : "Hisobingiz bormi? Kiring"}
        </button>
      </div>
    </div>
  );
}
