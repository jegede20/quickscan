// QR payload builders + render/download helpers (uses the `qrcode` npm package).

import QRCode from "qrcode";

export type WifiForm = {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
};

/** Escape \ ; , : " per the WIFI: payload convention. */
function escapeWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, "\\$1");
}

/** Standard WIFI:T:...;S:...;P:...;; payload. */
export function buildWifiPayload(w: WifiForm): string {
  const parts = [`T:${w.security}`, `S:${escapeWifi(w.ssid)}`];
  if (w.security !== "nopass") parts.push(`P:${escapeWifi(w.password)}`);
  if (w.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

/** Draw a QR code onto a canvas element (live preview). */
export function renderQr(
  canvas: HTMLCanvasElement,
  text: string,
  size: number
): Promise<void> {
  return QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#FFFFFF" },
  });
}

/** High-res PNG data URL for download/share. */
export async function qrPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#FFFFFF" },
  });
}

export function downloadQrPng(dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "quickscan-qr.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
