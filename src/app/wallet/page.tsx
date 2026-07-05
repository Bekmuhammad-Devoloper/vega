import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatUzs, formatDate } from "@/lib/format";
import { TopupWidget } from "@/components/TopupWidget";

const typeLabel: Record<string, { text: string; sign: string; color: string }> = {
  TOPUP: { text: "To'ldirish", sign: "+", color: "text-green-400" },
  PURCHASE: { text: "Xarid", sign: "", color: "text-red-400" },
  REFUND: { text: "Qaytarish", sign: "+", color: "text-green-400" },
};

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="text-sm text-[var(--muted)]">Joriy balans</div>
        <div className="text-3xl font-bold">{formatUzs(user.balance)}</div>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Balansni to&apos;ldirish</h2>
        <TopupWidget />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Harakatlar tarixi</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Hali harakatlar yo&apos;q.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {transactions.map((t) => {
              const meta = typeLabel[t.type] ?? {
                text: t.type,
                sign: "",
                color: "",
              };
              return (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{meta.text}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {t.note} · {formatDate(t.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${meta.color}`}>
                      {meta.sign}
                      {formatUzs(Math.abs(t.amount))}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatUzs(t.balanceAfter)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
