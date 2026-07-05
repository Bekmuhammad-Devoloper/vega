"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatUzs } from "@/lib/format";
import type { SafeUser } from "@/lib/auth";

export function Header({ user }: { user: SafeUser | null }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="text-xl">🌟</span>
          <span>
            Vega<span className="text-[var(--brand)]">.uz</span>
          </span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/history" className="hidden text-sm text-[var(--muted)] hover:text-white sm:block">
              Tarix
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/admin" className="hidden text-sm text-[var(--muted)] hover:text-white sm:block">
                Admin
              </Link>
            )}
            <Link
              href="/wallet"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-semibold transition hover:border-[var(--brand)]/60"
              title="Hamyon — balansni to'ldirish"
            >
              💰 {formatUzs(user.balance)}
            </Link>
            <button onClick={logout} className="btn btn-ghost !px-3 !py-1.5 text-sm">
              Chiqish
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primary !px-4 !py-1.5 text-sm">
            Kirish
          </Link>
        )}
      </div>
    </header>
  );
}
