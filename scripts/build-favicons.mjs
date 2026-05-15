#!/usr/bin/env node
/**
 * Rasterize public/favicon.svg into the PNG variants browsers + iOS expect.
 *
 * Output:
 *   - public/icon-192.png        (PWA manifest icon, normal)
 *   - public/icon-512.png        (PWA manifest icon, maskable splash)
 *   - public/apple-touch-icon.png (180×180 iOS home-screen)
 *
 * Run via `pnpm build:favicons` after editing favicon.svg. Single source
 * of truth is the SVG — every other size is derived.
 *
 * Not generating favicon.ico here: modern browsers prefer the SVG link.
 * The existing favicon.ico stays as IE/legacy fallback; regenerate via
 * favicon.io or a similar tool if you want a richer multi-resolution ICO.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const TARGETS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

const svg = await readFile(join(publicDir, 'favicon.svg'))

for (const { name, size } of TARGETS) {
  const out = join(publicDir, name)
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out)
  // Verify via re-read so script fails loudly on a silently-empty write.
  const written = await readFile(out)
  if (written.length < 100) throw new Error(`${name}: suspiciously small (${written.length}B)`)
  console.log(`✓ ${name} (${size}×${size}, ${written.length}B)`)
}

// Also re-emit a copy of the SVG into the public dir's expected slot — no-op
// today, but lets a CI-deployed pipeline call this script as the single
// favicon-build step.
await writeFile(join(publicDir, 'favicon.svg'), svg)
console.log(`✓ favicon.svg (verified)`)
