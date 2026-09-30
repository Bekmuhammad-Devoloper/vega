import { config, costToUzsPrice } from "@/lib/config";
import { lztBoard } from "@/lib/provider/lzt";
import { heroBoard } from "@/lib/provider/herosms";
import { istarBoard } from "@/lib/provider/istar";
import { ok, fail } from "@/lib/http";

type Row = { slug: string; price: number | null; count: number };

// GET /api/catalog?product=telegram — har bir davlat (Premium: muddat,
// Stars: paket) bo'yicha narx (so'm) va zaxira. Manba yo'q bo'lsa board: null.
export async function GET(req: Request) {
  try {
    const product = new URL(req.url).searchParams.get("product") || "";
    let board: Row[] | null = null;

    if (product === "tg_stars") {
      if (config.istarApiKey) {
        board = istarBoard().map((r) => ({
          slug: r.slug,
          price: costToUzsPrice(r.costUsd, "USD"),
          count: 999,
        }));
      }
    } else if (product === "telegram" || product === "tg_premium") {
      const rows = config.lztApiKey ? await lztBoard(product) : null;
      board =
        rows?.map((r) => ({
          slug: r.slug,
          price: r.costRub != null ? costToUzsPrice(r.costRub, "RUB") : null,
          count: r.count,
        })) ?? null;
    } else {
      const rows = await heroBoard(product);
      board =
        rows?.map((r) => ({
          slug: r.slug,
          price: r.costUsd != null ? costToUzsPrice(r.costUsd, "USD") : null,
          count: r.count,
        })) ?? null;
    }
    return ok({ board });
  } catch (e) {
    return fail(e);
  }
}
