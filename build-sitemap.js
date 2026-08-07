#!/usr/bin/env node
/**
 * build-sitemap.js
 * Discovers public HTML pages and generates sitemap.xml + robots.txt
 * for https://deltaforcecheat.com
 *
 * Usage: node build-sitemap.js
 * Or:    npm run sitemap
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE_ORIGIN = 'https://deltaforcecheat.com';
const ROOT = __dirname;
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const ROBOTS_PATH = path.join(ROOT, 'robots.txt');

/** Files that must never appear in the sitemap */
const EXCLUDE_FILES = new Set([
  // Add draft/template HTML filenames here if needed
]);

/** Path substrings that mean "skip this image" */
const IMAGE_SKIP = [
  'logo',
  'default-monochrome',
  'favicon',
  'apple-touch-icon',
  '/locales/',
];

/**
 * Optional per-file overrides (filename → fields).
 * Use when auto-detection should not decide loc / priority alone.
 */
const PAGE_OVERRIDES = {
  'index.html': {
    loc: `${SITE_ORIGIN}/`,
    changefreq: 'weekly',
    priority: 1.0,
  },
  'delta-force-cheats.html': {
    loc: `${SITE_ORIGIN}/delta-force-cheats`,
    changefreq: 'weekly',
    priority: 0.95,
  },
  'blog.html': {
    loc: `${SITE_ORIGIN}/blog`,
    changefreq: 'weekly',
    priority: 0.9,
  },
  'guide.html': {
    loc: `${SITE_ORIGIN}/guide`,
    changefreq: 'weekly',
    priority: 0.85,
  },
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${SITE_ORIGIN}${withSlash}`;
}

/** Encode path segments (spaces etc.) while keeping a valid absolute URL */
function encodeUrl(url) {
  try {
    const u = new URL(url);
    u.pathname = u.pathname
      .split('/')
      .map((seg) => (seg ? encodeURIComponent(decodeURIComponent(seg)) : ''))
      .join('/');
    return u.href;
  } catch {
    return url;
  }
}

function formatPriority(priority) {
  // Keep one decimal for .0/.5-style values; two for .85/.95 etc.
  return Number.isInteger(priority * 10) ? priority.toFixed(1) : priority.toFixed(2);
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rarr;/g, '→');
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return decodeHtmlEntities(m[1].replace(/\s+/g, ' ').trim());
}

function extractCanonical(html) {
  const m = html.match(
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
  ) || html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i
  );
  return m ? m[1].trim() : null;
}

function isNoIndex(html) {
  const robots = html.match(
    /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  if (!robots) return false;
  return /\bnoindex\b/i.test(robots[1]);
}

function extractOgImage(html) {
  const m = html.match(
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  ) || html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i
  );
  return m ? m[1].trim() : null;
}

function shouldSkipImage(url) {
  const lower = url.toLowerCase();
  return IMAGE_SKIP.some((s) => lower.includes(s)) || /\.svg(\?|$)/i.test(lower);
}

/**
 * Collect content images from the page (hero / article covers / previews).
 * Skips logos, icons, and SVGs.
 */
function extractContentImages(html) {
  const found = [];
  const seen = new Set();

  const push = (raw, title) => {
    const abs = toAbsoluteUrl(raw);
    if (!abs || shouldSkipImage(abs)) return;
    const encoded = encodeUrl(abs);
    if (seen.has(encoded)) return;
    seen.add(encoded);
    found.push({ loc: encoded, title: title || null });
  };

  const og = extractOgImage(html);
  if (og) push(og, null);

  // Prefer first meaningful article / preview / hero images
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRe.exec(html)) !== null) {
    const tag = match[0];
    const src = match[1];
    if (!/\/assets\//i.test(src)) continue;

    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]).trim() : '';
    push(src, alt || null);

    // Cap so homepage / buy pages don't flood the sitemap
    if (found.length >= 6) break;
  }

  return found;
}

function defaultPriority(filename) {
  if (filename === 'index.html') return 1.0;
  if (filename === 'delta-force-cheats.html') return 0.95;
  if (filename === 'blog.html') return 0.9;
  if (filename === 'guide.html') return 0.85;
  if (filename.startsWith('blog-') || filename === 'blog-article.html') return 0.7;
  return 0.6;
}

function defaultChangefreq(filename) {
  if (
    filename === 'index.html' ||
    filename === 'delta-force-cheats.html' ||
    filename === 'blog.html' ||
    filename === 'guide.html'
  ) {
    return 'weekly';
  }
  return 'monthly';
}

function discoverPages() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html') && !EXCLUDE_FILES.has(f))
    .sort((a, b) => a.localeCompare(b));

  const pages = [];
  const seenLoc = new Set();

  for (const file of files) {
    const fullPath = path.join(ROOT, file);
    const html = fs.readFileSync(fullPath, 'utf8');

    if (isNoIndex(html)) {
      console.log(`skip (noindex): ${file}`);
      continue;
    }

    const override = PAGE_OVERRIDES[file] || {};
    const canonical = extractCanonical(html);
    let loc = override.loc || (canonical ? canonical : null);

    if (!loc) {
      // Fallback: map filename → extensionless URL
      if (file === 'index.html') loc = `${SITE_ORIGIN}/`;
      else loc = `${SITE_ORIGIN}/${file.replace(/\.html$/i, '')}`;
    }

    // Normalize origin + https
    loc = loc.replace(/^http:\/\//i, 'https://');
    if (!loc.startsWith(SITE_ORIGIN)) {
      console.warn(`warn: ${file} canonical is off-domain (${loc}) — remapping`);
      if (file === 'index.html') loc = `${SITE_ORIGIN}/`;
      else loc = `${SITE_ORIGIN}/${file.replace(/\.html$/i, '')}`;
    }

    if (seenLoc.has(loc)) {
      console.warn(`skip duplicate loc: ${file} → ${loc}`);
      continue;
    }
    seenLoc.add(loc);

    const title = extractTitle(html);
    const images = extractContentImages(html).map((img) => ({
      loc: img.loc,
      title: img.title || title,
    }));

    // Prefer absolute og:image titles from page title when missing
    const mtime = fs.statSync(fullPath).mtime;

    pages.push({
      file,
      loc,
      lastmod: formatDate(mtime),
      changefreq: override.changefreq || defaultChangefreq(file),
      priority: override.priority != null ? override.priority : defaultPriority(file),
      images,
      title,
    });
  }

  // Home first, then by priority desc, then loc
  pages.sort((a, b) => {
    if (a.loc === `${SITE_ORIGIN}/`) return -1;
    if (b.loc === `${SITE_ORIGIN}/`) return 1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.loc.localeCompare(b.loc);
  });

  return pages;
}

function renderSitemap(pages) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
  );

  for (const page of pages) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(page.loc)}</loc>`);
    lines.push(`    <lastmod>${page.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${page.changefreq}</changefreq>`);
    lines.push(`    <priority>${formatPriority(page.priority)}</priority>`);

    for (const img of page.images) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${escapeXml(img.loc)}</image:loc>`);
      if (img.title) {
        lines.push(`      <image:title>${escapeXml(img.title)}</image:title>`);
      }
      lines.push('    </image:image>');
    }

    lines.push('  </url>');
  }

  lines.push('</urlset>');
  lines.push('');
  return lines.join('\n');
}

function renderRobots() {
  return `# robots.txt — ${SITE_ORIGIN}
User-agent: *
Allow: /

# Translation JSON is not meant to be indexed as standalone pages
Disallow: /locales/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

function main() {
  const pages = discoverPages();
  const xml = renderSitemap(pages);
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  fs.writeFileSync(ROBOTS_PATH, renderRobots(), 'utf8');

  console.log(`Wrote ${path.relative(ROOT, SITEMAP_PATH)} (${pages.length} URLs)`);
  console.log(`Wrote ${path.relative(ROOT, ROBOTS_PATH)}`);
  for (const p of pages) {
    const imgCount = p.images.length;
    console.log(
      `  ${formatPriority(p.priority).padStart(4)}  ${p.loc}${imgCount ? `  (${imgCount} image${imgCount === 1 ? '' : 's'})` : ''}`
    );
  }
}

main();
