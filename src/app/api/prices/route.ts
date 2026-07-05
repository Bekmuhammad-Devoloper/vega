import { provider } from "@/lib/provider";
import { usdToUzsPrice } from "@/lib/config";
import { ok, fail } from "@/lib/http";

// GET /api/prices?product=telegram&country=usa
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const product = searchParams.get("product");
    const country = searchParams.get("country");
    if (!product || !country) {
      return Response.json(
        { error: "product va country talab qilinadi" },
        { status: 400 }
      );
    }

    const price = await provider.getPrice(product, country);
    if (!price || price.count <= 0) {
      return ok({ available: false, price: null, count: 0 });
    }
    return ok({
      available: true,
      price: usdToUzsPrice(price.costRub),
      count: price.count,
    });
  } catch (e) {
    return fail(e);
  }
}
