import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// SVG definitions based on Lakhi Airconditioners brand icon
const svgContentStandard = `<svg viewBox="0 0 160 160" width="512" height="512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer Circular Base -->
  <circle cx="80" cy="80" r="74" fill="#111827" />

  <!-- Red Quarter Arc (Top Right) -->
  <path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill="#DC2626" />

  <!-- White Inner Lightning Circle -->
  <circle cx="50" cy="80" r="27" stroke="#FFFFFF" stroke-width="5.5" fill="none" />

  <!-- Lightning Bolt -->
  <path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="#FFFFFF" />

  <!-- Stylized L cutout -->
  <path d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z" fill="#FFFFFF" />
</svg>`;

// Maskable icon with 15% safe-zone margin on a dark red/slate bleed background
const svgContentMaskable = `<svg viewBox="0 0 512 512" width="512" height="512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Full-bleed background -->
  <rect width="512" height="512" fill="#0F172A" />
  
  <!-- Scaled inside safe zone (central 80% circle) -->
  <g transform="translate(64, 64) scale(2.4)">
    <!-- Outer Circular Base -->
    <circle cx="80" cy="80" r="74" fill="#111827" />

    <!-- Red Quarter Arc (Top Right) -->
    <path d="M 80 10 A 70 70 0 0 1 150 80 L 80 80 Z" fill="#DC2626" />

    <!-- White Inner Lightning Circle -->
    <circle cx="50" cy="80" r="27" stroke="#FFFFFF" stroke-width="5.5" fill="none" />

    <!-- Lightning Bolt -->
    <path d="M 52 58 L 40 81 L 49 81 L 46 101 L 60 76 L 51 76 Z" fill="#FFFFFF" />

    <!-- Stylized L cutout -->
    <path d="M 76 22 L 98 22 L 98 114 C 98 126 108 134 122 134 L 140 134 L 140 148 L 118 148 C 92 148 76 132 76 110 Z" fill="#FFFFFF" />
  </g>
</svg>`;

async function generate() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write public/icon.svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContentStandard, 'utf8');
  console.log('Written public/icon.svg');

  const standardBuffer = Buffer.from(svgContentStandard);
  const maskableBuffer = Buffer.from(svgContentMaskable);

  // 2. Generate pwa-192x192.png
  await sharp(standardBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated public/pwa-192x192.png');

  // 3. Generate pwa-512x512.png
  await sharp(standardBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated public/pwa-512x512.png');

  // 4. Generate pwa-maskable-512x512.png
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated public/pwa-maskable-512x512.png');

  // 5. Generate apple-touch-icon.png (180x180)
  await sharp(maskableBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated public/apple-touch-icon.png');

  // 6. Generate favicon-32x32.png and favicon.ico
  await sharp(standardBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Generated public/favicon-32x32.png');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
