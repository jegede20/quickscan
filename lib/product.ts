// Product lookup via Open Food Facts. The only network call in the app,
// and only fired for barcode values the user explicitly opens.

export type Product = {
  name: string;
  brand: string;
  quantity: string;
  category: string;
  image: string | null;
  url: string | null;
};

export type ProductState =
  | { status: "loading" }
  | { status: "ok"; product: Product }
  | { status: "notfound" }
  | { status: "offline" }
  | { status: "timeout" }
  | { status: "error" };

const TIMEOUT_MS = 8000;
const API = "https://world.openfoodfacts.org/api/v2/product";

export async function lookupProduct(code: string): Promise<ProductState> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "offline" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const fields = "product_name,brands,quantity,categories,image_front_url,product_url";
    const res = await fetch(
      `${API}/${encodeURIComponent(code)}.json?fields=${fields}`,
      { signal: controller.signal }
    );
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as {
      status?: number;
      product?: Record<string, unknown>;
    };
    const p = data.product;
    if (data.status === 0 || !p) return { status: "notfound" };

    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const product: Product = {
      name: str(p.product_name) || "Unnamed product",
      brand: str(p.brands),
      quantity: str(p.quantity),
      category: str(p.categories).split(",").map((c) => c.trim()).filter(Boolean).slice(-1)[0] ?? "",
      image: str(p.image_front_url) || null,
      url: str(p.product_url) || null,
    };
    return { status: "ok", product };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { status: "timeout" };
    }
    return { status: "error" };
  } finally {
    clearTimeout(timer);
  }
}
