import type { ResultType } from "./types";

/** Known URL shorteners — links through these hide their real destination. */
const SHORTENER_DOMAINS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "tiny.cc",
  "t.ly",
  "rb.gy",
  "cutt.ly",
  "shorturl.at",
  "rebrand.ly",
  "lnkd.in",
  "s.id",
  "cli.re",
  "cuty.io",
  "bl.ink",
];

export type LinkWarning = {
  kind: "shortener" | "lookalike" | "ip" | "insecure";
  label: string;
};

export type LinkInfo = {
  /** What the Open action should launch. */
  href: string;
  /** Small chip label: "Verified domain", "Shortened link", "Email", ... */
  label: string;
  /** Chip body text in mono: hostname + path (or the raw address for mailto/tel). */
  display: string;
  warnings: LinkWarning[];
};

const IPv4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

function isIpHost(hostname: string): boolean {
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true; // IPv6 literal
  return IPv4_RE.test(hostname);
}

function hostMatchesList(hostname: string, list: string[]): boolean {
  return list.some((d) => hostname === d || hostname.endsWith("." + d));
}

/** Classify a decoded string given its symbology. Barcodes are product codes. */
export function classify(value: string, format: string): ResultType {
  if (format !== "qr_code") return "product";
  const v = value.trim();
  const upper = v.toUpperCase();
  if (upper.startsWith("WIFI:")) return "wifi";
  if (upper.startsWith("BEGIN:VCARD") || upper.startsWith("MECARD:")) return "contact";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return "url";
  return "text";
}

/** Analyze a value classified as `url`. Returns chip display data + safety warnings. */
export function analyzeLink(value: string): LinkInfo {
  const v = value.trim();
  const mail = v.match(/^mailto:(.+)$/i);
  if (mail) {
    return { href: v, label: "Email", display: mail[1], warnings: [] };
  }
  const tel = v.match(/^tel:(.+)$/i);
  if (tel) {
    return { href: v, label: "Phone", display: tel[1], warnings: [] };
  }

  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return { href: v, label: "Link", display: v, warnings: [] };
  }

  const hostname = url.hostname.toLowerCase();
  const warnings: LinkWarning[] = [];

  if (url.protocol === "http:") {
    warnings.push({ kind: "insecure", label: "Not secure (HTTP)" });
  }
  if (isIpHost(hostname)) {
    warnings.push({ kind: "ip", label: "IP address host" });
  }
  if (hostname.split(".").some((label) => label.startsWith("xn--"))) {
    warnings.push({ kind: "lookalike", label: "Look-alike domain" });
  }
  if (hostMatchesList(hostname, SHORTENER_DOMAINS)) {
    warnings.push({ kind: "shortener", label: "Shortened link" });
  }

  const path = url.pathname === "/" ? "" : url.pathname;
  return {
    href: v,
    label: warnings.length > 0 ? warnings[0].label : "Verified domain",
    display: hostname + path,
    warnings,
  };
}

/** Parse the standard WIFI:T:...;S:...;P:...;; payload. */
export function parseWifi(value: string): {
  ssid: string;
  security: string;
  password: string;
  hidden: boolean;
} | null {
  const m = value.trim().match(/^WIFI:(.*);;?$/i);
  if (!m) return null;
  const body = m[1];

  const fields: Record<string, string> = {};
  let buf = "";
  let key = "";
  let escaped = false;
  for (const ch of body) {
    if (escaped) {
      buf += ch;
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === ":") {
      key = buf;
      buf = "";
    } else if (ch === ";") {
      if (key) fields[key.toUpperCase()] = buf;
      key = "";
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (key) fields[key.toUpperCase()] = buf;

  return {
    ssid: fields.S ?? "",
    security: (fields.T ?? "nopass").toUpperCase(),
    password: fields.P ?? "",
    hidden: fields.H === "true",
  };
}

/** Minimal vCard / MECARD parse for the result sheet. */
export function parseContact(value: string): {
  name: string;
  phone: string;
  email: string;
} {
  const out = { name: "", phone: "", email: "" };
  const upper = value.trim().toUpperCase();

  if (upper.startsWith("MECARD:")) {
    const name = value.match(/N:((?:\\.|[^;])*)/i);
    const tel = value.match(/TEL:((?:\\.|[^;])*)/i);
    const mail = value.match(/EMAIL:((?:\\.|[^;])*)/i);
    out.name = (name?.[1] ?? "")
      .replace(/\\(.)/g, "$1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .reverse()
      .join(" ");
    out.phone = (tel?.[1] ?? "").replace(/\\(.)/g, "$1");
    out.email = (mail?.[1] ?? "").replace(/\\(.)/g, "$1");
    return out;
  }

  // vCard: look at the first N/TEL/EMAIL entries.
  const fn = value.match(/(?:^|\n)FN[^:]*:(.*)/i);
  const n = value.match(/(?:^|\n)N[^:]*:(.*)/i);
  const tel = value.match(/(?:^|\n)TEL[^:]*:(.*)/i);
  const mail = value.match(/(?:^|\n)EMAIL[^:]*:(.*)/i);
  const nVal = (n?.[1] ?? "").trim();
  out.name =
    (fn?.[1] ?? "").trim() ||
    nVal
      .split(";")
      .filter(Boolean)
      .reverse()
      .join(" ")
      .trim();
  out.phone = (tel?.[1] ?? "").trim();
  out.email = (mail?.[1] ?? "").trim();
  return out;
}

/** Human-readable label per type, shown in pills and rows. */
export const TYPE_LABELS: Record<ResultType, string> = {
  url: "URL",
  text: "Text",
  wifi: "Wi-Fi",
  contact: "Contact",
  product: "Product",
};

/** Normalized format → short label for the sheet/history. */
export const FORMAT_LABELS: Record<string, string> = {
  qr_code: "QR code",
  ean_13: "EAN-13",
  ean_8: "EAN-8",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
  code_128: "Code 128",
  code_39: "Code 39",
  itf: "ITF",
  codabar: "Codabar",
  code_93: "Code 93",
  data_matrix: "Data Matrix",
};

export function formatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format.toUpperCase();
}
