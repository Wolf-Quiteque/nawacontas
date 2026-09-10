// Gera os ícones da PWA a partir de um SVG (executar: npm run icons)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F28C1B"/>
      <stop offset="1" stop-color="#FFC533"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <path d="M166 118h132l82 82v194a18 18 0 0 1-18 18H166a18 18 0 0 1-18-18V136a18 18 0 0 1 18-18z" fill="#fff"/>
    <path d="M298 118v64a18 18 0 0 0 18 18h64z" fill="#FFE2B8"/>
    <rect x="186" y="238" width="140" height="18" rx="9" fill="#F28C1B"/>
    <rect x="186" y="280" width="140" height="18" rx="9" fill="#F28C1B"/>
    <rect x="186" y="322" width="90" height="18" rx="9" fill="#FFC533"/>
  </g>
</svg>`;

await mkdir("public/icons", { recursive: true });
const jobs = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/maskable-512.png", 512, 72],
  ["public/icons/apple-touch-icon.png", 180, 0],
  ["src/app/icon.png", 64, 0],
  ["src/app/apple-icon.png", 180, 0],
];
for (const [file, size, pad] of jobs) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(file);
  console.log("✓", file);
}
