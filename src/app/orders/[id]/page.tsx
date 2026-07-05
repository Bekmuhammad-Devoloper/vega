import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderView } from "@/components/OrderView";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, userId: user.id } });
  if (!order) notFound();

  return <OrderView initial={JSON.parse(JSON.stringify(order))} />;
}
