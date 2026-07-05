import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderRow } from "@/components/OrderRow";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buyurtmalar tarixi</h1>
      {orders.length === 0 ? (
        <p className="text-[var(--muted)]">Hali buyurtmalar yo&apos;q.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <OrderRow key={o.id} order={JSON.parse(JSON.stringify(o))} />
          ))}
        </div>
      )}
    </div>
  );
}
