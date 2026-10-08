"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  Download,
  Package,
  Search,
  Star,
  Trash2,
  Type,
  UserRound,
  Wifi,
  Link2,
} from "lucide-react";
import { ResultSheet } from "@/components/result-sheet";
import { exportHistoryCsv } from "@/lib/csv";
import { TYPE_LABELS } from "@/lib/parse";
import { removeItem, toggleFavorite, useHistory } from "@/lib/storage";
import type { ResultType, ScanItem } from "@/lib/types";

const TYPE_ICONS: Record<ResultType, typeof Link2> = {
  url: Link2,
  text: Type,
  wifi: Wifi,
  contact: UserRound,
  product: Package,
};

function whenLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

export default function HistoryPage() {
  const items = useHistory();
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [sheetItem, setSheetItem] = useState<ScanItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (favOnly && !i.favorite) return false;
      if (!q) return true;
      return (
        i.value.toLowerCase().includes(q) ||
        TYPE_LABELS[i.type].toLowerCase().includes(q) ||
        i.format.includes(q)
      );
    });
  }, [items, query, favOnly]);

  return (
    <div className="flex flex-1 flex-col px-5 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <button
          type="button"
          onClick={() => exportHistoryCsv(items)}
          disabled={items.length === 0}
          aria-label="Export CSV"
          className="flex h-11 items-center gap-2 rounded-ctl border border-border bg-surface px-3.5 text-sm text-ink disabled:opacity-40"
        >
          <Download className="h-[18px] w-[18px]" strokeWidth={1.5} />
          Export CSV
        </button>
      </header>

      {/* Search */}
      <div className="relative mb-3">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
          strokeWidth={1.5}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history"
          className="h-12 w-full rounded-ctl border border-border bg-surface pl-11 pr-4 text-base text-ink outline-none placeholder:text-muted focus:border-ink"
        />
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex gap-2">
        {[
          { label: "All", active: !favOnly, onClick: () => setFavOnly(false) },
          {
            label: "Favorites",
            active: favOnly,
            onClick: () => setFavOnly(true),
          },
        ].map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={f.onClick}
            className={`h-9 rounded-full px-4 text-sm transition-colors motion-reduce:transition-none ${
              f.active
                ? "bg-ink text-bg font-medium"
                : "border border-border bg-surface text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-20 text-center">
          <Clock className="h-8 w-8 text-muted" strokeWidth={1.5} />
          <p className="text-base text-ink">
            {items.length === 0
              ? "No scans yet"
              : favOnly
                ? "No favorites yet"
                : "No matches"}
          </p>
          <p className="max-w-[240px] text-sm text-muted">
            {items.length === 0
              ? "Codes you open from the scanner are saved here."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl border border-border">
                  <Icon className="h-[18px] w-[18px] text-muted" strokeWidth={1.5} />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSheetItem({
                      value: item.value,
                      format: item.format,
                      type: item.type,
                    });
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-mono text-sm text-ink">
                    {item.value}
                  </p>
                  <p className="text-xs text-muted">
                    {TYPE_LABELS[item.type]} · {whenLabel(item.updatedAt)}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label={item.favorite ? "Remove favorite" : "Add favorite"}
                  aria-pressed={item.favorite}
                  onClick={() => toggleFavorite(item.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                >
                  <Star
                    className={`h-[18px] w-[18px] ${
                      item.favorite ? "fill-accent text-accent" : "text-muted"
                    }`}
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => removeItem(item.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted"
                >
                  <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ResultSheet
        item={sheetItem}
        onClose={() => setSheetItem(null)}
        isFavorite={
          sheetItem !== null &&
          items.some((i) => i.id === sheetItem.value && i.favorite)
        }
        onToggleFavorite={() => {
          if (sheetItem) toggleFavorite(sheetItem.value);
        }}
      />
    </div>
  );
}
