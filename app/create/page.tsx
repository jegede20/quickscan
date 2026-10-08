"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { Switch } from "@/components/switch";
import {
  buildWifiPayload,
  downloadQrPng,
  qrPngDataUrl,
  renderQr,
  type WifiForm,
} from "@/lib/qr";

type Kind = "text" | "url" | "wifi";

const KINDS: { id: Kind; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "url", label: "URL" },
  { id: "wifi", label: "Wi-Fi" },
];

const inputClass =
  "w-full rounded-ctl border border-border bg-surface px-3.5 text-base text-ink outline-none placeholder:text-muted focus:border-ink";

export default function CreatePage() {
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [wifi, setWifi] = useState<WifiForm>({
    ssid: "",
    password: "",
    security: "WPA",
    hidden: false,
  });
  const [done, setDone] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const payload =
    kind === "text"
      ? text.trim()
      : kind === "url"
        ? url.trim()
        : wifi.ssid.trim()
          ? buildWifiPayload(wifi)
          : "";

  // Live preview, lightly debounced.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!payload) return;
    const id = window.setTimeout(() => {
      renderQr(canvas, payload, 448).catch(() => {});
    }, 120);
    return () => window.clearTimeout(id);
  }, [payload]);

  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(null), 1800);
    return () => window.clearTimeout(id);
  }, [done]);

  const onDownload = useCallback(async () => {
    if (!payload) return;
    try {
      const dataUrl = await qrPngDataUrl(payload);
      downloadQrPng(dataUrl);
    } catch {
      setDone("failed");
    }
  }, [payload]);

  const onShare = useCallback(async () => {
    if (!payload) return;
    try {
      const dataUrl = await qrPngDataUrl(payload);
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "quickscan-qr.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "QuickScan" });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: payload });
        return;
      }
      downloadQrPng(dataUrl);
      setDone("download");
    } catch {
      // cancelled or unsupported
    }
  }, [payload]);

  return (
    <div className="flex flex-1 flex-col px-5 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Create</h1>

      {/* Type pills */}
      <div className="mb-4 flex gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`h-9 rounded-full px-4 text-sm transition-colors motion-reduce:transition-none ${
              kind === k.id
                ? "bg-ink text-bg font-medium"
                : "border border-border bg-surface text-muted"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-3">
        {kind === "text" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text"
            rows={3}
            className={`${inputClass} resize-none py-3`}
          />
        )}

        {kind === "url" && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className={`${inputClass} h-12`}
          />
        )}

        {kind === "wifi" && (
          <>
            <input
              type="text"
              value={wifi.ssid}
              onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
              placeholder="Network name"
              className={`${inputClass} h-12`}
            />
            <select
              value={wifi.security}
              onChange={(e) =>
                setWifi({
                  ...wifi,
                  security: e.target.value as WifiForm["security"],
                })
              }
              aria-label="Security type"
              className={`${inputClass} h-12`}
            >
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">None</option>
            </select>
            {wifi.security !== "nopass" && (
              <input
                type="text"
                value={wifi.password}
                onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                placeholder="Password"
                className={`${inputClass} h-12`}
              />
            )}
            <div className="flex items-center justify-between rounded-ctl border border-border bg-surface px-3.5 py-3">
              <span className="text-base text-ink">Hidden network</span>
              <Switch
                checked={wifi.hidden}
                onChange={(hidden) => setWifi({ ...wifi, hidden })}
                label="Hidden network"
              />
            </div>
          </>
        )}
      </div>

      {/* QR preview */}
      <div className="mt-5 flex flex-col items-center rounded-card border border-border bg-surface p-6">
        {payload ? (
          <canvas
            ref={canvasRef}
            width={448}
            height={448}
            className="h-[224px] w-[224px] rounded-ctl"
          />
        ) : (
          <div className="flex h-[224px] w-[224px] items-center justify-center rounded-ctl border border-dashed border-border">
            <p className="max-w-[140px] text-center text-sm text-muted">
              Your QR code appears here
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          disabled={!payload}
          onClick={() => void onDownload()}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-ctl bg-accent text-base font-medium text-white disabled:opacity-40"
        >
          {done === "download" ? (
            <>
              Saved
              <Check className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </>
          ) : (
            <>
              Download PNG
              <Download className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </>
          )}
        </button>
        <button
          type="button"
          disabled={!payload}
          onClick={() => void onShare()}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-ctl border border-border bg-surface text-base font-medium text-ink disabled:opacity-40"
        >
          Share
          <Share2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
