"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ImagePlus,
  Link2,
  Package,
  ShieldCheck,
  Type,
  UserRound,
  Wifi,
  Zap,
} from "lucide-react";
import { createDecoder, type Decoder } from "@/lib/decode";
import { analyzeLink, classify, TYPE_LABELS } from "@/lib/parse";
import type { Point, ResultType, ScanItem, ScanResult } from "@/lib/types";
import { LogoMark } from "@/components/logo";

type CamState =
  | "idle"
  | "starting"
  | "live"
  | "denied"
  | "nocam"
  | "insecure"
  | "error";

type Target = {
  key: string;
  item: ScanItem;
  corners: Point[];
  firstSeen: number;
  lastSeen: number;
};

const CHIP_W = 232;
const CHIP_H = 64;
const TAB_BAR_CLEARANCE = 72;
const STALE_MS = 850;
const TICK_MS = 110;

const TYPE_ICONS: Record<ResultType, typeof Link2> = {
  url: Link2,
  text: Type,
  wifi: Wifi,
  contact: UserRound,
  product: Package,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Map a point from source pixels to the object-cover display box. */
function mapToDisplay(
  p: Point,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): Point {
  const s = Math.max(dw / sw, dh / sh);
  return { x: p.x * s + (dw - sw * s) / 2, y: p.y * s + (dh - sh * s) / 2 };
}

function lerpCorners(prev: Point[] | undefined, next: Point[]): Point[] {
  if (!prev || prev.length !== next.length) return next;
  return next.map((p, i) => ({
    x: prev[i].x * 0.4 + p.x * 0.6,
    y: prev[i].y * 0.4 + p.y * 0.6,
  }));
}

function chipSpot(corners: Point[], cw: number, ch: number) {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const left = clamp(
    (minX + maxX) / 2 - CHIP_W / 2,
    10,
    Math.max(10, cw - CHIP_W - 10)
  );
  let top = minY - CHIP_H - 12;
  if (top < 10) top = maxY + 12;
  top = clamp(
    top,
    10,
    Math.max(10, ch - CHIP_H - 10 - TAB_BAR_CLEARANCE)
  );
  return { left, top };
}

/** Corner brackets for a quad — two short strokes per corner along its edges. */
function BracketPath({ corners, width = 3 }: { corners: Point[]; width?: number }) {
  const d = corners
    .map((p, i) => {
      const next = corners[(i + 1) % 4];
      const prev = corners[(i + 3) % 4];
      const seg = (to: Point) => {
        const dx = to.x - p.x;
        const dy = to.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const t = Math.min(28, len * 0.35) / len;
        return { x: p.x + dx * t, y: p.y + dy * t };
      };
      const a = seg(next);
      const b = seg(prev);
      return `M${a.x} ${a.y}L${p.x} ${p.y}L${b.x} ${b.y}`;
    })
    .join("");
  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
  );
}

export function Scanner({
  onChipTap,
  onAutoOpen,
  onImageResult,
  autoOpen,
}: {
  onChipTap: (result: ScanResult) => void;
  onAutoOpen: (result: ScanResult) => void;
  onImageResult: (result: ScanResult | null) => void;
  autoOpen: boolean;
}) {
  const [camState, setCamState] = useState<CamState>("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decoderRef = useRef<Decoder | null>(null);
  const intervalRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const targetsRef = useRef<Map<string, Target>>(new Map());
  const autoOpenedRef = useRef<Set<string>>(new Set());
  const autoOpenRef = useRef(autoOpen);
  const onAutoOpenRef = useRef(onAutoOpen);
  const onImageResultRef = useRef(onImageResult);
  const onChipTapRef = useRef(onChipTap);

  useEffect(() => {
    autoOpenRef.current = autoOpen;
    onAutoOpenRef.current = onAutoOpen;
    onImageResultRef.current = onImageResult;
    onChipTapRef.current = onChipTap;
  }, [autoOpen, onAutoOpen, onImageResult, onChipTap]);

  const decoder = useCallback((): Decoder => {
    if (!decoderRef.current) decoderRef.current = createDecoder();
    return decoderRef.current;
  }, []);

  const stopLoop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    busyRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    targetsRef.current = new Map();
    setTargets([]);
    setTorchOn(false);
    setTorchSupported(false);
    setCamState("idle");
  }, [stopLoop]);

  const tick = useCallback(async () => {
    if (busyRef.current) return;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || video.readyState < 2 || video.videoWidth === 0)
      return;
    busyRef.current = true;
    try {
      const out = await decoder().detect(video);
      const rect = container.getBoundingClientRect();
      const now = performance.now();
      const map = targetsRef.current;
      const prevSize = map.size;
      const seen = new Set<string>();

      for (const hit of out.hits) {
        const key = `${hit.format}|${hit.value}`;
        seen.add(key);
        const corners = hit.corners.map((p) =>
          mapToDisplay(p, out.width, out.height, rect.width, rect.height)
        );
        const existing = map.get(key);
        map.set(key, {
          key,
          item: {
            value: hit.value,
            format: hit.format,
            type: classify(hit.value, hit.format),
          },
          corners: lerpCorners(existing?.corners, corners),
          firstSeen: existing?.firstSeen ?? now,
          lastSeen: now,
        });
      }

      for (const [key, t] of map) {
        if (!seen.has(key) && now - t.lastSeen > STALE_MS) map.delete(key);
      }

      if (map.size > 0 || prevSize > 0) setTargets([...map.values()]);

      if (autoOpenRef.current) {
        for (const t of map.values()) {
          if (t.item.type !== "url") continue;
          if (autoOpenedRef.current.has(t.key)) continue;
          if (now - t.firstSeen < 1200) continue; // must be stable first
          autoOpenedRef.current.add(t.key);
          onAutoOpenRef.current({
            ...t.item,
            corners: t.corners,
          });
        }
      }
    } catch {
      // Transient decode failures are fine; the next tick retries.
    } finally {
      busyRef.current = false;
    }
  }, [decoder]);

  const startLoop = useCallback(() => {
    stopLoop();
    intervalRef.current = window.setInterval(() => void tick(), TICK_MS);
  }, [stopLoop, tick]);

  const startCamera = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setCamState("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState("nocam");
      return;
    }
    setCamState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        setCamState("error");
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});

      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() ?? {};
      setTorchSupported("torch" in caps);
      autoOpenedRef.current = new Set();
      setCamState("live");
      startLoop();
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCamState("denied");
      } else if (
        name === "NotFoundError" ||
        name === "OverconstrainedError" ||
        name === "DevicesNotFoundError"
      ) {
        setCamState("nocam");
      } else {
        setCamState("error");
      }
    }
  }, [startLoop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  // Stop the stream whenever the tab is hidden or the page unmounts.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopCamera();
    };
  }, [stopCamera]);

  // Track the viewfinder box so brackets/chips can be placed in display space.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-clear transient hints.
  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 3500);
    return () => window.clearTimeout(id);
  }, [hint]);

  const handleFile = useCallback(
    async (file: File) => {
      setHint("Decoding image…");
      try {
        const bitmap = await createImageBitmap(file);
        const out = await decoder().detect(bitmap);
        bitmap.close();
        if (out.hits.length > 0) {
          const hit = out.hits[0];
          setHint(null);
          onImageResultRef.current({
            value: hit.value,
            format: hit.format,
            type: classify(hit.value, hit.format),
            corners: hit.corners,
          });
        } else {
          setHint("No code found in this image");
        }
      } catch {
        setHint("Could not read that image");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [decoder]
  );

  const openChip = useCallback(
    (t: Target) => {
      onChipTapRef.current({ ...t.item, corners: t.corners });
    },
    []
  );

  const live = camState === "live";
  const idleFrame = (() => {
    if (!size.w || !size.h) return null;
    const side = Math.min(size.w, size.h) * 0.68;
    const x = (size.w - side) / 2;
    const y = (size.h - side) / 2 - 24;
    return { x, y, side };
  })();

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-[#0E0E0E]"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Corner brackets + scan line */}
      {live && (
        <svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.55))]"
          aria-hidden
        >
          {targets.length === 0 && idleFrame ? (
            <BracketPath
              corners={[
                { x: idleFrame.x, y: idleFrame.y },
                { x: idleFrame.x + idleFrame.side, y: idleFrame.y },
                {
                  x: idleFrame.x + idleFrame.side,
                  y: idleFrame.y + idleFrame.side,
                },
                { x: idleFrame.x, y: idleFrame.y + idleFrame.side },
              ]}
            />
          ) : (
            targets.map((t) => (
              <BracketPath key={t.key} corners={t.corners} />
            ))
          )}
        </svg>
      )}

      {/* Scan line (only while no code is detected) */}
      {live && targets.length === 0 && idleFrame && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10"
          style={{
            left: idleFrame.x,
            top: idleFrame.y,
            width: idleFrame.side,
            height: idleFrame.side,
          }}
        >
          <div className="qs-scanline absolute left-3.5 right-3.5 top-[8%] h-1 rounded-full bg-accent motion-safe:animate-qs-scan" />
        </div>
      )}

      {/* Live chips */}
      <div className="pointer-events-none absolute inset-0 z-30">
        {targets.map((t) => {
          const spot = chipSpot(t.corners, size.w || 390, size.h || 700);
          const link = t.item.type === "url" ? analyzeLink(t.item.value) : null;
          const Icon = TYPE_ICONS[t.item.type];
          const label = link ? link.label : TYPE_LABELS[t.item.type];
          const display = link
            ? link.display
            : t.item.type === "text"
              ? t.item.value.trim().replace(/\s+/g, " ")
              : t.item.value;
          const warned = (link?.warnings.length ?? 0) > 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => openChip(t)}
              className="motion-safe:animate-qs-pop pointer-events-auto absolute flex h-16 items-center gap-2.5 rounded-full border border-border bg-surface px-2.5 text-left transition-[left,top] duration-150 ease-out motion-reduce:transition-none"
              style={{ left: spot.left, top: spot.top, width: CHIP_W }}
            >
              <Icon className="h-[18px] w-[18px] shrink-0 text-muted" strokeWidth={1.5} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs">
                  {link ? (
                    warned ? (
                      <AlertTriangle className="h-3 w-3 text-error" strokeWidth={1.5} />
                    ) : (
                      <ShieldCheck className="h-3 w-3 text-success" strokeWidth={1.5} />
                    )
                  ) : null}
                  <span className={warned ? "text-error" : "text-muted"}>
                    {label}
                  </span>
                </span>
                <span className="block truncate font-mono text-sm text-ink">
                  {display}
                </span>
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <ArrowUpRight className="h-[18px] w-[18px] text-white" strokeWidth={1.5} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Header: torch · title · image */}
      <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="w-11">
          {live && torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? "Torch off" : "Torch on"}
              aria-pressed={torchOn}
              className={`flex h-11 w-11 items-center justify-center rounded-full border bg-black/25 backdrop-blur-[2px] transition-colors motion-reduce:transition-none ${
                torchOn
                  ? "border-accent text-accent"
                  : "border-white/40 text-white"
              }`}
            >
              <Zap className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Scan
        </h1>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Scan from image"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/25 text-white backdrop-blur-[2px]"
        >
          <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom hint */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(76px+env(safe-area-inset-bottom))] transition-opacity duration-200 motion-reduce:transition-none ${
          hint || (camState !== "idle" && camState !== "starting")
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        <p className="max-w-[85%] rounded-full bg-black/45 px-3.5 py-2 text-center text-sm text-white">
          {hint ??
            (targets.length > 0
              ? "Tap a chip to open the result"
              : "Point your camera at a QR code or barcode")}
        </p>
      </div>

      {/* Start / permission states */}
      {!live && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#111111] px-8 text-center">
          {camState === "idle" && (
            <>
              <LogoMark size={72} />
              <p className="text-2xl font-bold tracking-tight text-white">
                Quick<span className="font-normal">Scan</span>
              </p>
              <p className="max-w-[280px] text-sm text-white/70">
                Scan QR codes and barcodes live. Everything stays on your
                device.
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-2 h-12 rounded-ctl bg-accent px-8 text-base font-medium text-white"
              >
                Start camera
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-12 rounded-ctl border border-white/40 px-6 text-base font-medium text-white"
              >
                Scan from image
              </button>
            </>
          )}

          {camState === "starting" && (
            <p className="text-base text-white/80">Starting camera…</p>
          )}

          {camState !== "idle" && camState !== "starting" && (
            <>
              <AlertTriangle className="h-8 w-8 text-accent" strokeWidth={1.5} />
              <p className="text-xl font-semibold tracking-tight text-white">
                {camState === "denied"
                  ? "Camera access blocked"
                  : camState === "nocam"
                    ? "No camera found"
                    : camState === "insecure"
                      ? "HTTPS required"
                      : "Camera error"}
              </p>
              <p className="max-w-[280px] text-sm text-white/70">
                {camState === "denied"
                  ? "Allow camera access in your browser settings, then try again."
                  : camState === "nocam"
                    ? "This device or browser did not expose a camera. You can still scan from an image."
                    : camState === "insecure"
                      ? "Browsers only allow the camera on a secure (HTTPS) connection."
                      : "Something went wrong starting the camera."}
              </p>
              {camState !== "insecure" && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-2 h-12 rounded-ctl bg-accent px-8 text-base font-medium text-white"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-12 rounded-ctl border border-white/40 px-6 text-base font-medium text-white"
              >
                Scan from image
              </button>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
