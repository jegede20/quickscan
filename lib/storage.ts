"use client";

// localStorage-backed history, favorites and settings. No accounts, no server.
// The store is subscribable so React can read it with useSyncExternalStore.

import { useSyncExternalStore } from "react";
import type { CodeFormat, ResultType } from "./types";

const HISTORY_KEY = "qs-history-v1";
const SETTINGS_KEY = "qs-settings-v1";
export const THEME_KEY = "qs-theme";

export const HISTORY_LIMIT = 500;

export type HistoryItem = {
  id: string; // equals the scanned value; used for dedup
  value: string;
  type: ResultType;
  format: CodeFormat;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Settings = {
  vibrate: boolean;
  sound: boolean;
  autoOpen: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  vibrate: true,
  sound: false,
  autoOpen: false,
};

/* ── Tiny external store ───────────────────────────────────── */

const listeners = new Set<() => void>();
const EMPTY_HISTORY: HistoryItem[] = [];
let historyCache: HistoryItem[] | null = null;
let settingsCache: Settings | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ── Persistence primitives ────────────────────────────────── */

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readHistory(): HistoryItem[] {
  try {
    const items = safeParse<HistoryItem[]>(
      localStorage.getItem(HISTORY_KEY),
      []
    );
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]): void {
  historyCache = items;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked — the app keeps working in memory.
  }
  emit();
}

/** Enforce the cap: oldest non-favorites go first. */
function trim(items: HistoryItem[]): HistoryItem[] {
  if (items.length <= HISTORY_LIMIT) return items;
  const overflow = items.length - HISTORY_LIMIT;
  const dropped = new Set<string>();
  // Items are stored newest-first, so walk backwards to reach the oldest.
  for (let i = items.length - 1; i >= 0 && dropped.size < overflow; i--) {
    if (!items[i].favorite) dropped.add(items[i].id);
  }
  // Everything left is a favorite — drop the oldest of those too.
  for (let i = items.length - 1; i >= 0 && dropped.size < overflow; i--) {
    dropped.add(items[i].id);
  }
  return items.filter((i) => !dropped.has(i.id));
}

/* ── History actions ───────────────────────────────────────── */

/**
 * Record a scan. History is written only when the user opens a result,
 * never for every code the camera sees. Re-scanning a value refreshes
 * its timestamp instead of adding a duplicate.
 */
export function upsertScan(item: {
  value: string;
  type: ResultType;
  format: CodeFormat;
}): void {
  const items = historyCache ?? readHistory();
  const now = Date.now();
  const idx = items.findIndex((i) => i.id === item.value);
  if (idx >= 0) {
    const updated: HistoryItem = {
      ...items[idx],
      type: item.type,
      format: item.format,
      updatedAt: now,
    };
    writeHistory(trim([updated, ...items.slice(0, idx), ...items.slice(idx + 1)]));
    return;
  }
  const entry: HistoryItem = {
    id: item.value,
    value: item.value,
    type: item.type,
    format: item.format,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
  writeHistory(trim([entry, ...items]));
}

export function toggleFavorite(id: string): void {
  const items = (historyCache ?? readHistory()).map((i) =>
    i.id === id ? { ...i, favorite: !i.favorite } : i
  );
  writeHistory(items);
}

export function removeItem(id: string): void {
  writeHistory((historyCache ?? readHistory()).filter((i) => i.id !== id));
}

/* ── Settings actions ──────────────────────────────────────── */

function readSettings(): Settings {
  try {
    const s = safeParse<Partial<Settings>>(localStorage.getItem(SETTINGS_KEY), {});
    return {
      vibrate: s.vibrate ?? DEFAULT_SETTINGS.vibrate,
      sound: s.sound ?? DEFAULT_SETTINGS.sound,
      autoOpen: s.autoOpen ?? DEFAULT_SETTINGS.autoOpen,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  settingsCache = settings;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
  emit();
}

export function clearAllData(): void {
  historyCache = EMPTY_HISTORY;
  settingsCache = DEFAULT_SETTINGS;
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // ignore
  }
  emit();
}

/* ── React hooks ───────────────────────────────────────────── */

function getHistorySnapshot(): HistoryItem[] {
  historyCache ??= readHistory();
  return historyCache;
}

function getSettingsSnapshot(): Settings {
  settingsCache ??= readSettings();
  return settingsCache;
}

export function useHistory(): HistoryItem[] {
  return useSyncExternalStore(subscribe, getHistorySnapshot, () => EMPTY_HISTORY);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    subscribe,
    getSettingsSnapshot,
    () => DEFAULT_SETTINGS
  );
}
