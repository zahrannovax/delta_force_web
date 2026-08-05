#!/usr/bin/env node
/**
 * optimize-images.js
 * Generates responsive WebP variants for key content images.
 *
 * Output: /assets/responsive/{slug}-{width}.webp
 * Widths: 480, 768, 960, 1280 (skips sizes >= source width)
 *
 * Usage: npm run images
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ASSETS = path.join(ROOT, 'assets');
const OUT_DIR = path.join(ASSETS, 'responsive');
const WIDTHS = [480, 768, 960, 1280];

/** Canonical content images used as heroes / covers / previews */
const SOURCES = [
  'hero-bg.webp',
  'getting-started.jpg',
  'best-delta-force-cheat-review.jpg',
  'player-esp-delta-force.jpg',
  'aimbot-setup-guide.jpg',
  'vehicle-esp-delta-force.jpg',
  'cloud-dma-aws-options.webp',
  'hwid-spoofer-explained.webp',
  'esp-configuration-guide.webp',
  'advanced-aimbot-delta-force.webp',
  'weapon-gadget-esp-delta-force.webp',
  'no-recoil-fov-control.webp',
  'Hack Preview Image 1.webp',
  'Hack Preview Image 2.webp',
];

function slugify(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp is not installed. Run: npm install sharp --save-dev');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = {};

  for (const file of SOURCES) {
    const srcPath = path.join(ASSETS, file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`missing: ${file}`);
      continue;
    }

    const slug = slugify(file);
    const meta = await sharp(srcPath).metadata();
    const srcW = meta.width || 0;
    const variants = [];

    for (const w of WIDTHS) {
      if (srcW && w >= srcW) continue;
      const outName = `${slug}-${w}.webp`;
      const outPath = path.join(OUT_DIR, outName);
      await sharp(srcPath)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toFile(outPath);
      const stat = fs.statSync(outPath);
      variants.push({ width: w, file: `assets/responsive/${outName}`, bytes: stat.size });
      console.log(`  ${outName} (${Math.round(stat.size / 1024)} KB)`);
    }

    // Always keep a near-native webp so desktop/retina aren't stuck on 480w-only sources
    const maxW = Math.min(srcW || 1600, 1600);
    if (maxW >= 320 && !variants.some((v) => v.width === maxW)) {
      const outName = `${slug}-${maxW}.webp`;
      const outPath = path.join(OUT_DIR, outName);
      await sharp(srcPath)
        .resize({ width: maxW, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(outPath);
      const stat = fs.statSync(outPath);
      variants.push({ width: maxW, file: `assets/responsive/${outName}`, bytes: stat.size });
      console.log(`  ${outName} (${Math.round(stat.size / 1024)} KB)`);
    }

    variants.sort((a, b) => a.width - b.width);
    manifest[file] = {
      slug,
      sourceWidth: srcW,
      variants,
    };
    console.log(`ok ${file} → ${variants.length} variants`);
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${path.relative(ROOT, manifestPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
