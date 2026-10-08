# QuickScan

A free QR code and barcode scanner that runs as a mobile-responsive web app and installs as a PWA. All decoding happens on-device — no accounts, no backend, no cost.

- **Live scanning** with the native BarcodeDetector API (zxing-wasm fallback for iOS Safari), corner brackets that snap onto codes, and Google Lens-style chips you tap to open.
- **Link safety**: real hostnames always visible, warnings for shorteners, look-alike (`xn--`) domains, IP hosts and non-HTTPS links.
- **Scan from image** as a camera-free fallback.
- **Product lookup** for barcodes via Open Food Facts (the only network call in the app).
- **QR generator** for Text, URL and Wi-Fi with PNG download and share.
- **History & favorites** in localStorage with search, CSV export (`quickscan-history.csv`) and a 500-item cap.
- **PWA**: installable, offline app shell (scanning works offline).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Camera access requires HTTPS (or localhost).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run generate-assets` | One-time: renders PNG icons from the logo SVG and copies the zxing wasm into `public/` (already run; never part of the build) |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · BarcodeDetector + zxing-wasm · qrcode · lucide-react · Open Food Facts · localStorage.

Everything is client-side. The only outbound request is the product-code lookup against Open Food Facts.
