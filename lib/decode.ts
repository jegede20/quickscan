// On-device decoding: native BarcodeDetector when available, zxing-wasm otherwise.
// Everything runs locally; frames are never uploaded.

import type { Point } from "./types";

export type DecodeHit = {
  value: string;
  format: string;
  /** Corner points in the source's own pixel space (video frame or image). */
  corners: Point[];
};

export type DecodeOutput = {
  hits: DecodeHit[];
  /** Intrinsic size of the decoded source, for mapping corners to the display. */
  width: number;
  height: number;
};

const NATIVE_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
];

const ZXING_FORMATS: import("zxing-wasm/reader").ReadInputBarcodeFormat[] = [
  "QRCode",
  "EAN13",
  "EAN8",
  "UPCA",
  "UPCE",
  "Code128",
  "Code39",
  "ITF",
];

/** Map native / zxing format spellings onto one normalized name. */
const FORMAT_MAP: Record<string, string> = {
  qr_code: "qr_code",
  qrcode: "qr_code",
  ean_13: "ean_13",
  ean13: "ean_13",
  ean_8: "ean_8",
  ean8: "ean_8",
  upc_a: "upc_a",
  upca: "upc_a",
  upc_e: "upc_e",
  upce: "upc_e",
  code_128: "code_128",
  code128: "code_128",
  code_39: "code_39",
  code39: "code_39",
  itf: "itf",
  codabar: "codabar",
  code_93: "code_93",
  code93: "code_93",
  data_matrix: "data_matrix",
  datamatrix: "data_matrix",
};

export function normalizeFormat(format: string): string {
  return FORMAT_MAP[format.toLowerCase()] ?? format.toLowerCase();
}

type NativeCornerPoint = { x: number; y: number };
type NativeDetected = {
  rawValue: string;
  format: string;
  cornerPoints?: NativeCornerPoint[];
  boundingBox?: { x: number; y: number; width: number; height: number };
};
type NativeDetector = {
  detect(source: CanvasImageSource): Promise<NativeDetected[]>;
};

function createNativeDetector(): NativeDetector | null {
  const Ctor = (
    window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => NativeDetector;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: NATIVE_FORMATS });
  } catch {
    return null;
  }
}

type ZxingModule = typeof import("zxing-wasm/reader");

let zxingPromise: Promise<ZxingModule> | null = null;

function loadZxing(): Promise<ZxingModule> {
  if (!zxingPromise) {
    zxingPromise = import("zxing-wasm/reader").then(async (mod) => {
      // Serve the wasm from our own origin so the fallback works offline.
      await mod.prepareZXingModule({
        overrides: {
          locateFile: (file: string) =>
            file.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : file,
        },
        fireImmediately: true,
      });
      return mod;
    });
  }
  return zxingPromise;
}

function cornersFromNative(hit: NativeDetected): Point[] | null {
  if (hit.cornerPoints && hit.cornerPoints.length === 4) {
    return hit.cornerPoints.map((p) => ({ x: p.x, y: p.y }));
  }
  const b = hit.boundingBox;
  if (b) {
    return [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ];
  }
  return null;
}

export type Decoder = {
  /** Detect codes in a live video frame or an image. */
  detect(source: HTMLVideoElement | ImageBitmap): Promise<DecodeOutput>;
  /** Which engine is doing the work ("native" | "zxing"). */
  engine: () => "native" | "zxing";
};

export function createDecoder(): Decoder {
  const native = createNativeDetector();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  async function detectWithZxing(
    source: HTMLVideoElement | ImageBitmap
  ): Promise<DecodeOutput> {
    const sw =
      source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const sh =
      source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    if (!sw || !sh || !ctx) return { hits: [], width: sw, height: sh };

    // Cap the long edge so mid-range phones stay smooth.
    const scale = Math.min(1, 1280 / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.drawImage(source, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    const zxing = await loadZxing();
    const results = await zxing.readBarcodes(imageData, {
      formats: ZXING_FORMATS,
      tryHarder: true,
      tryRotate: true,
    });

    const inv = 1 / scale;
    const hits: DecodeHit[] = [];
    for (const r of results) {
      if (!r.isValid || !r.text) continue;
      const pos = r.position;
      hits.push({
        value: r.text,
        format: normalizeFormat(r.format),
        corners: [
          { x: pos.topLeft.x * inv, y: pos.topLeft.y * inv },
          { x: pos.topRight.x * inv, y: pos.topRight.y * inv },
          { x: pos.bottomRight.x * inv, y: pos.bottomRight.y * inv },
          { x: pos.bottomLeft.x * inv, y: pos.bottomLeft.y * inv },
        ],
      });
    }
    return { hits, width: sw, height: sh };
  }

  return {
    engine: () => (native ? "native" : "zxing"),
    async detect(source) {
      const sw =
        source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const sh =
        source instanceof HTMLVideoElement ? source.videoHeight : source.height;
      if (native) {
        try {
          const results = await native.detect(source);
          const hits: DecodeHit[] = [];
          for (const r of results) {
            if (!r.rawValue) continue;
            const corners = cornersFromNative(r);
            if (!corners) continue;
            hits.push({
              value: r.rawValue,
              format: normalizeFormat(r.format),
              corners,
            });
          }
          return { hits, width: sw, height: sh };
        } catch {
          // Native implementation failed mid-flight — fall through to zxing.
        }
      }
      return detectWithZxing(source);
    },
  };
}
