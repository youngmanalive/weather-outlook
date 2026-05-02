// One-shot script: render the SVG sources in public/ to PNG variants used for
// favicons and social/Open Graph cards. Run with `node scripts/build-images.mjs`
// from the project root. Requires `sharp` (install with `npm i -D sharp`).

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

const targets = [
  { src: "og-image.svg", out: "og-image.png", width: 1200, height: 630 },
  { src: "favicon.svg", out: "apple-touch-icon.png", width: 180, height: 180 },
  { src: "favicon.svg", out: "favicon-32.png", width: 32, height: 32 },
  { src: "favicon.svg", out: "favicon-16.png", width: 16, height: 16 },
];

for (const { src, out, width, height } of targets) {
  const svg = await readFile(join(publicDir, src));
  // density bumps the SVG rasterization DPI so small icons stay sharp
  const density = Math.max(72, Math.round((width / 64) * 72));
  const png = await sharp(svg, { density })
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(publicDir, out), png);
  console.log(`wrote public/${out} (${width}x${height})`);
}
