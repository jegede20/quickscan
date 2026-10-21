// Product lookup via the Open Facts family (food, beauty, pet food, products).
// Fired for barcodes the user opens, plus the favicon fetch in
// components/link-icon.tsx — the only network calls in the app; scan
// contents are never uploaded. All databases are free, keyless and global.

export type Product = {
  name: string;
  brand: string;
  quantity: string;
  category: string;
  image: string | null;
  url: string | null;
  source: string;
};

export type ProductState =
  | { status: "loading" }
  | { status: "ok"; product: Product }
  | { status: "notfound" }
  | { status: "offline" }
  | { status: "timeout" }
  | { status: "error" };

// A barcode lives in exactly one of these product types, so try them in turn.
const SOURCES = [
  {
    name: "Open Food Facts",
    api: "https://world.openfoodfacts.org/api/v2/product",
  },
  {
    name: "Open Beauty Facts",
    api: "https://world.openbeautyfacts.org/api/v2/product",
  },
  {
    name: "Open Pet Food Facts",
    api: "https://world.openpetfoodfacts.org/api/v2/product",
  },
  {
    name: "Open Products Facts",
    api: "https://world.openproductsfacts.org/api/v2/product",
  },
];

const TOTAL_TIMEOUT_MS = 12000;
const FIELDS =
  "product_name,brands,quantity,categories,image_front_url,product_url";

export async function lookupProduct(code: string): Promise<ProductState> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "offline" };
  }

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let anyResponse = false;

  for (const source of SOURCES) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { status: "timeout" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(
        `${source.api}/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
        { signal: controller.signal }
      );
      // 404 + {"status":0} means "not in this database" — try the next one.
      if (res.status === 404) {
        anyResponse = true;
        continue;
      }
      if (!res.ok) continue;
      anyResponse = true;
      const data = (await res.json()) as {
        status?: number;
        product?: Record<string, unknown>;
      };
      const p = data.product;
      if (data.status === 0 || !p) continue;

      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const product: Product = {
        name: str(p.product_name) || "Unnamed product",
        brand: str(p.brands),
        quantity: str(p.quantity),
        category:
          str(p.categories)
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
            .slice(-1)[0] ?? "",
        image: str(p.image_front_url) || null,
        url: str(p.product_url) || null,
        source: source.name,
      };
      return { status: "ok", product };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { status: "timeout" };
      }
      // Network hiccup on one database — keep trying the others.
    } finally {
      clearTimeout(timer);
    }
  }

  // Answers came back but nobody had it → genuinely not in any database.
  return anyResponse ? { status: "notfound" } : { status: "error" };
}
