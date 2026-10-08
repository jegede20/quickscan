"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Share2,
  Star,
  X,
} from "lucide-react";
import {
  analyzeLink,
  formatLabel,
  parseContact,
  parseWifi,
  TYPE_LABELS,
} from "@/lib/parse";
import { lookupProduct, type ProductState } from "@/lib/product";
import type { ScanItem } from "@/lib/types";

function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "success";
}) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs ${
        tone === "success" ? "text-success" : "text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="text-right text-sm text-ink break-all">{value}</span>
    </div>
  );
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export function ResultSheet({
  item,
  onClose,
  isFavorite,
  onToggleFavorite,
}: {
  item: ScanItem | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [lookup, setLookup] = useState<{
    key: string;
    state: ProductState;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [productAttempt, setProductAttempt] = useState(0);

  const lookupKey = item ? `${item.value}#${productAttempt}` : "";
  const product: ProductState | null =
    item?.type === "product"
      ? lookup && lookup.key === lookupKey
        ? lookup.state
        : { status: "loading" }
      : null;

  useEffect(() => {
    if (!item || item.type !== "product") return;
    const key = `${item.value}#${productAttempt}`;
    let cancelled = false;
    lookupProduct(item.value).then((state) => {
      if (!cancelled) setLookup({ key, state });
    });
    return () => {
      cancelled = true;
    };
  }, [item, productAttempt]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const link = item.type === "url" ? analyzeLink(item.value) : null;
  const wifi = item.type === "wifi" ? parseWifi(item.value) : null;
  const contact = item.type === "contact" ? parseContact(item.value) : null;

  const openTarget =
    item.type === "url"
      ? link?.href
      : item.type === "product" && product?.status === "ok"
        ? product.product.url
        : null;

  const onCopy = () => {
    void copyText(item.value).then(() => setCopied(true));
  };

  const onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "QuickScan", text: item.value });
        return;
      }
    } catch {
      return; // user cancelled or share failed — nothing to do
    }
    onCopy();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="motion-safe:animate-qs-sheet relative flex max-h-[85dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-card border-t border-border bg-surface">
        <div className="relative shrink-0 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4">
          {/* Status chips */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone="success">
              <Check className="h-3 w-3" strokeWidth={1.5} />
              Scanned
            </Pill>
            <Pill>{TYPE_LABELS[item.type]}</Pill>
            <Pill>{formatLabel(item.format)}</Pill>
          </div>

          {/* Value */}
          <div className="max-h-40 overflow-y-auto rounded-ctl border border-border bg-bg px-3 py-2.5">
            <p className="font-mono text-sm text-ink break-all whitespace-pre-wrap">
              {item.value}
            </p>
          </div>

          {/* Link warnings */}
          {link && link.warnings.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {link.warnings.map((w) => (
                <li
                  key={w.kind}
                  className="flex items-start gap-2 rounded-ctl border border-error/40 px-3 py-2 text-sm text-error"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.5}
                  />
                  <span>{w.label}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Type-specific details */}
          {wifi && (
            <div className="mt-3">
              <Row label="Network" value={wifi.ssid} />
              <Row label="Security" value={wifi.security} />
              <Row label="Password" value={wifi.password} />
            </div>
          )}

          {contact && (
            <div className="mt-3">
              <Row label="Name" value={contact.name} />
              <Row label="Phone" value={contact.phone} />
              <Row label="Email" value={contact.email} />
            </div>
          )}

          {item.type === "product" && (
            <div className="mt-3">
              {product?.status === "loading" && (
                <p className="py-4 text-center text-sm text-muted">
                  Looking up product…
                </p>
              )}
              {product?.status === "notfound" && (
                <p className="py-4 text-center text-sm text-muted">
                  No product info found
                </p>
              )}
              {product?.status === "offline" && (
                <p className="py-4 text-center text-sm text-muted">
                  You&apos;re offline — product lookup needs a connection
                </p>
              )}
              {product?.status === "timeout" && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-sm text-muted">Product lookup timed out</p>
                  <button
                    type="button"
                    onClick={() => setProductAttempt((n) => n + 1)}
                    className="h-9 rounded-ctl border border-border px-4 text-sm text-ink"
                  >
                    Try again
                  </button>
                </div>
              )}
              {product?.status === "error" && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-sm text-muted">
                    Couldn&apos;t reach product lookup
                  </p>
                  <button
                    type="button"
                    onClick={() => setProductAttempt((n) => n + 1)}
                    className="h-9 rounded-ctl border border-border px-4 text-sm text-ink"
                  >
                    Try again
                  </button>
                </div>
              )}
              {product?.status === "ok" && (
                <div>
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.product.image ?? "/icons/icon-192.png"}
                      alt=""
                      className="h-[72px] w-[72px] shrink-0 rounded-ctl border border-border object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-base font-medium text-ink">
                        {product.product.name}
                      </p>
                      <p className="text-sm text-muted">
                        {product.product.brand}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Row label="Brand" value={product.product.brand} />
                    <Row label="Quantity" value={product.product.quantity} />
                    <Row label="Category" value={product.product.category} />
                    <Row label="Source" value="Open Food Facts" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex items-center gap-2.5">
            {item.type === "url" && (
              <button
                type="button"
                onClick={() => {
                  if (openTarget) window.open(openTarget, "_blank", "noopener,noreferrer");
                }}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-ctl bg-accent text-base font-medium text-white"
              >
                Open
                <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
            )}
            {item.type === "product" && (
              <button
                type="button"
                disabled={!openTarget}
                onClick={() => {
                  if (openTarget) window.open(openTarget, "_blank", "noopener,noreferrer");
                }}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-ctl bg-accent text-base font-medium text-white disabled:opacity-40"
              >
                View details
                <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
            )}
            {item.type !== "url" && item.type !== "product" && (
              <button
                type="button"
                onClick={onCopy}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-ctl bg-accent text-base font-medium text-white"
              >
                {copied ? (
                  <>
                    Copied
                    <Check className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  </>
                ) : (
                  <>
                    Copy
                    <Copy className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  </>
                )}
              </button>
            )}
            {(item.type === "url" || item.type === "product") && (
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copy"
                className="flex h-12 w-12 items-center justify-center rounded-ctl border border-border text-ink"
              >
                {copied ? (
                  <Check className="h-[18px] w-[18px] text-success" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-[18px] w-[18px]" strokeWidth={1.5} />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => void onShare()}
              aria-label="Share"
              className="flex h-12 w-12 items-center justify-center rounded-ctl border border-border text-ink"
            >
              <Share2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
              aria-pressed={isFavorite}
              className="flex h-12 w-12 items-center justify-center rounded-ctl border border-border"
            >
              <Star
                className={`h-[18px] w-[18px] ${
                  isFavorite ? "fill-accent text-accent" : "text-ink"
                }`}
                strokeWidth={1.5}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
