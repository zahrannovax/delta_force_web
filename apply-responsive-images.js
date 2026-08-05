#!/usr/bin/env node
/**
 * apply-responsive-images.js
 * Rewrites content <img> tags to use srcset/sizes from assets/responsive/manifest.json
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MANIFEST = path.join(ROOT, 'assets', 'responsive', 'manifest.json');

/** sizes attribute by usage context (matched via surrounding markup heuristics) */
const SIZES = {
  hero: '100vw',
  cover: '(max-width: 768px) 100vw, min(1200px, 92vw)',
  preview: '(max-width: 768px) 100vw, (max-width: 1480px) 48vw, 700px',
  card: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px',
  default: '(max-width: 768px) 100vw, 800px',
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSrcset(variants) {
  return variants.map((v) => `/${v.file.replace(/\\/g, '/')} ${v.width}w`).join(', ');
}

function pickSizes(tag, file) {
  if (/hero-bg/i.test(file)) return SIZES.hero;
  if (/Hack Preview/i.test(file)) return SIZES.preview;

  const isPriority =
    /fetchpriority=["']high["']/i.test(tag) ||
    /loading=["']eager["']/i.test(tag);

  if (isPriority) return SIZES.cover;

  // Lazy content images are usually cards / secondary
  return SIZES.card;
}

function enhanceImgTag(tag, file, entry) {
  if (!entry || !entry.variants || !entry.variants.length) return tag;

  const srcset = buildSrcset(entry.variants);
  const fallback = `/${entry.variants[Math.min(entry.variants.length - 1, 2)].file.replace(/\\/g, '/')}`;
  const sizes = pickSizes(tag, file);

  let next = tag.replace(/\s+srcset=["'][^"']*["']/gi, '').replace(/\s+sizes=["'][^"']*["']/gi, '');

  next = next.replace(/\bsrc=(["'])([^"']*)\1/i, `src=$1${fallback}$1`);

  if (/\/>$/.test(next.trim())) {
    next = next.replace(/\s*\/>$/, ` srcset="${srcset}" sizes="${sizes}" />`);
  } else {
    next = next.replace(/>$/, ` srcset="${srcset}" sizes="${sizes}">`);
  }

  return next;
}

function processHtml(html, manifest) {
  let out = html;
  for (const [file, entry] of Object.entries(manifest)) {
    const encoded = file.replace(/ /g, '%20');
    const slug = entry.slug;
    const patterns = [
      new RegExp(`<img\\b[^>]*\\bsrc=["']/assets/${escapeRegExp(file)}["'][^>]*>`, 'gi'),
      new RegExp(`<img\\b[^>]*\\bsrc=["']/assets/${escapeRegExp(encoded)}["'][^>]*>`, 'gi'),
      new RegExp(`<img\\b[^>]*\\bsrc=["']/assets/responsive/${escapeRegExp(slug)}-\\d+\\.webp["'][^>]*>`, 'gi'),
    ];
    for (const re of patterns) {
      out = out.replace(re, (tag) => enhanceImgTag(tag, file, entry));
    }
  }

  return out;
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Run npm run images first (manifest missing).');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const full = path.join(ROOT, file);
    const html = fs.readFileSync(full, 'utf8');
    const next = processHtml(html, manifest);
    if (next !== html) {
      fs.writeFileSync(full, next, 'utf8');
      changed += 1;
      console.log(`updated ${file}`);
    }
  }
  console.log(`Done. ${changed} HTML file(s) updated.`);
}

main();
