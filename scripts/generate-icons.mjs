// One-time asset generator. Run manually (npm run generate-assets), never at build.
// Renders the QuickScan logo into PNG app icons and copies the zxing fallback wasm.

import sharp from "sharp";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");

// Rounded version (favicon / standard icons).
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="16" fill="#111111"/><g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"><path d="M18 28V18H28M44 18H54V28M54 44V54H44M28 54H18V44"/></g><rect x="11" y="34" width="50" height="4" rx="2" fill="#FF5A1F"/></svg>`;

// Full-bleed version (square corners) for maskable + Apple icons.
const fullbleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" fill="#111111"/><g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"><path d="M18 28V18H28M44 18H54V28M54 44V54H44M28 54H18V44"/></g><rect x="11" y="34" width="50" height="4" rx="2" fill="#FF5A1F"/></svg>`;

const jobs = [
  { name: "icon-192.png", svg: rounded, size: 192 },
  { name: "icon-512.png", svg: rounded, size: 512 },
  { name: "icon-maskable-512.png", svg: fullbleed, size: 512 },
  { name: "apple-touch-icon.png", svg: fullbleed, size: 180 },
  { name: "favicon-32.png", svg: rounded, size: 32 },
];

await mkdir(iconsDir, { recursive: true });

for (const job of jobs) {
  await sharp(Buffer.from(job.svg), { density: 300 })
    .resize(job.size, job.size)
    .png()
    .toFile(join(iconsDir, job.name));
  console.log(`✓ public/icons/${job.name}`);
}

// Copy the zxing reader wasm so the decode fallback works offline.
const wasmSrc = join(root, "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
const wasmDest = join(root, "public", "zxing", "zxing_reader.wasm");
await mkdir(join(root, "public", "zxing"), { recursive: true });
await copyFile(wasmSrc, wasmDest);
console.log("✓ public/zxing/zxing_reader.wasm");
