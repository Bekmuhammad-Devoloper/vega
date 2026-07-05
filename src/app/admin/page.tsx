import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatUzs } from "@/lib/format";
import { TopupForm } from "@/components/TopupForm";
import { PendingPayments } from "@/components/PendingPayments";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      balance: true,
      role: true,
      _count: { select: { orders: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin panel</h1>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Kutilayotgan to&apos;lovlar</h2>
        <PendingPayments />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Qo&apos;lda balans to&apos;ldirish</h2>
        <TopupForm />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Foydalanuvchilar ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Buyurtma</th>
                <th className="py-2">Balans</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">
                    {u.role === "ADMIN" ? "👑 Admin" : "Foydalanuvchi"}
                  </td>
                  <td className="py-2 pr-4">{u._count.orders}</td>
                  <td className="py-2 font-semibold">{formatUzs(u.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
