import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Crisp Standard Brand SVG (for any purpose, apple-touch-icon, and browser tabs)
const brandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#2563eb" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Background rounded squircle -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

  <!-- Subtle outer border line -->
  <rect x="4" y="4" width="504" height="504" rx="108" fill="none" stroke="#334155" stroke-width="6" opacity="0.6" />

  <!-- Central Clipboard Card with Inspection Checkmark -->
  <g filter="url(#glow)">
    <!-- Shield / Card Body -->
    <rect x="116" y="112" width="280" height="324" rx="36" fill="url(#shieldGrad)" stroke="#38bdf8" stroke-width="7" stroke-opacity="0.8" />

    <!-- Top Clipboard Clip -->
    <rect x="196" y="84" width="120" height="52" rx="16" fill="url(#accentGrad)" />
    <circle cx="256" cy="110" r="10" fill="#0f172a" />

    <!-- Document Checklist Rows -->
    <rect x="160" y="180" width="44" height="44" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="4" />
    <path d="M170 202 L178 210 L194 194" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="222" y="194" width="134" height="16" rx="8" fill="#94a3b8" />

    <rect x="160" y="246" width="44" height="44" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="4" />
    <path d="M170 268 L178 276 L194 260" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="222" y="260" width="112" height="16" rx="8" fill="#94a3b8" />

    <!-- Big Prominent Checkmark Badge on lower right -->
    <circle cx="340" cy="360" r="54" fill="url(#accentGrad)" stroke="#0f172a" stroke-width="8" />
    <path d="M318 360 L334 376 L366 344" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- Brand Typography bottom accent -->
  <text x="256" y="474" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" letter-spacing="4" fill="#38bdf8" text-anchor="middle">CAST INSPECT</text>
</svg>`;

// 2. Maskable Brand SVG with full bleed background and safe zone (central 80%)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>

  <!-- Full-bleed background for maskable (circle, teardrop, squircle safe) -->
  <rect width="512" height="512" fill="url(#bgGrad)" />

  <!-- Centered scaled group strictly inside 80% safe zone (x: 51 to 461, y: 51 to 461) -->
  <g transform="translate(56, 56) scale(0.78)">
    <!-- Shield / Card Body -->
    <rect x="116" y="112" width="280" height="324" rx="36" fill="url(#shieldGrad)" stroke="#38bdf8" stroke-width="8" />

    <!-- Top Clipboard Clip -->
    <rect x="196" y="84" width="120" height="52" rx="16" fill="url(#accentGrad)" />
    <circle cx="256" cy="110" r="10" fill="#0f172a" />

    <!-- Document Checklist Rows -->
    <rect x="160" y="180" width="44" height="44" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="4" />
    <path d="M170 202 L178 210 L194 194" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="222" y="194" width="134" height="16" rx="8" fill="#94a3b8" />

    <rect x="160" y="246" width="44" height="44" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="4" />
    <path d="M170 268 L178 276 L194 260" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="222" y="260" width="112" height="16" rx="8" fill="#94a3b8" />

    <!-- Big Prominent Checkmark Badge on lower right -->
    <circle cx="340" cy="360" r="54" fill="url(#accentGrad)" stroke="#0f172a" stroke-width="8" />
    <path d="M318 360 L334 376 L366 344" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />

    <text x="256" y="474" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="900" letter-spacing="4" fill="#38bdf8" text-anchor="middle">CAST INSPECT</text>
  </g>
</svg>`;

async function generate() {
  console.log('Generating PWA icons...');

  // Save SVG
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), brandSvg, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), maskableSvg, 'utf-8');

  // Generate 512x512 standard PNG
  await sharp(Buffer.from(brandSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // Generate 192x192 standard PNG
  await sharp(Buffer.from(brandSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // Generate 512x512 maskable PNG
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // Generate 180x180 apple-touch-icon.png for iOS
  await sharp(Buffer.from(brandSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Generate 32x32 favicon.png and 64x64
  await sharp(Buffer.from(brandSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  await sharp(Buffer.from(brandSvg))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('PWA icons successfully generated in /public!');
}

generate().catch(console.error);
