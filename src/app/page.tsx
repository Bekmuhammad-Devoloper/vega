import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BuyPanel } from "@/components/BuyPanel";
import { isMockMode } from "@/lib/config";
import { OrderRow } from "@/components/OrderRow";
import { Landing } from "@/components/Landing";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const recent = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      {isMockMode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          ⚠️ <b>DEMO rejim:</b> haqiqiy raqam sotib olinmaydi. Haqiqiy ishlash
          uchun <code>.env</code> ichiga <code>FIVESIM_API_KEY</code> qo&apos;shing.
        </div>
      )}

      <section>
        <h1 className="mb-1 text-2xl font-bold">Raqam sotib olish</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Xizmat va davlatni tanlang — SMS tasdiqlash uchun vaqtinchalik raqam
          olasiz.
        </p>
        <BuyPanel />
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Oxirgi buyurtmalar</h2>
            <Link href="/history" className="text-sm text-[var(--brand)] hover:underline">
              Barchasi →
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((o) => (
              <OrderRow key={o.id} order={JSON.parse(JSON.stringify(o))} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
