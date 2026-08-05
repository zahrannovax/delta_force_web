#!/usr/bin/env node
/**
 * build-assets.js — minify CSS/JS for production (keeps source files).
 * Usage: npm run minify
 */
'use strict';

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const { minify } = require('terser');

const ROOT = __dirname;
const ASSET_VERSION = '25';

const CSS_FILES = ['style.css', 'blog.css', 'guide.css'];
const JS_FILES = ['main.js', 'i18n.js'];

async function minifyCss() {
  const cleaner = new CleanCSS({
    level: {
      1: { specialComments: 0 },
      2: { removeUnusedAtRules: false, restructureRules: true },
    },
  });

  for (const name of CSS_FILES) {
    const src = path.join(ROOT, 'css', name);
    const out = path.join(ROOT, 'css', name.replace(/\.css$/, '.min.css'));
    const input = fs.readFileSync(src, 'utf8');
    const result = cleaner.minify(input);
    if (result.errors.length) {
      console.error(name, result.errors);
      process.exit(1);
    }
    fs.writeFileSync(out, result.styles, 'utf8');
    const before = Buffer.byteLength(input);
    const after = Buffer.byteLength(result.styles);
    console.log(
      `css ${name}: ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB (−${Math.round(
        (1 - after / before) * 100
      )}%)`
    );
  }
}

async function minifyJs() {
  for (const name of JS_FILES) {
    const src = path.join(ROOT, 'js', name);
    const out = path.join(ROOT, 'js', name.replace(/\.js$/, '.min.js'));
    const input = fs.readFileSync(src, 'utf8');
    const result = await minify(input, {
      compress: { passes: 2, drop_console: true },
      mangle: true,
      format: { comments: false },
    });
    if (result.error) throw result.error;
    fs.writeFileSync(out, result.code, 'utf8');
    const before = Buffer.byteLength(input);
    const after = Buffer.byteLength(result.code);
    console.log(
      `js  ${name}: ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB (−${Math.round(
        (1 - after / before) * 100
      )}%)`
    );
  }
}

/** Point HTML at minified CSS/JS + bump cache version */
function wireHtml() {
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const full = path.join(ROOT, file);
    let html = fs.readFileSync(full, 'utf8');
    const before = html;

    html = html.replace(/\/css\/style(\.min)?\.css\?v=\d+/g, `/css/style.min.css?v=${ASSET_VERSION}`);
    html = html.replace(/\/css\/blog(\.min)?\.css\?v=\d+/g, `/css/blog.min.css?v=${ASSET_VERSION}`);
    html = html.replace(/\/css\/guide(\.min)?\.css\?v=\d+/g, `/css/guide.min.css?v=${ASSET_VERSION}`);

    html = html.replace(/\/js\/i18n(\.min)?\.js(\?v=\d+)?/g, `/js/i18n.min.js?v=${ASSET_VERSION}`);
    html = html.replace(/\/js\/main(\.min)?\.js(\?v=\d+)?/g, `/js/main.min.js?v=${ASSET_VERSION}`);

    // Prefer local Lenis over CDN
    html = html.replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/@studio-freight\/lenis@[^"']+\/lenis\.min\.js/g,
      '/js/vendor/lenis.min.js'
    );

    if (html !== before) {
      fs.writeFileSync(full, html, 'utf8');
      changed += 1;
      console.log(`wired ${file}`);
    }
  }
  console.log(`HTML wired: ${changed} file(s), asset v=${ASSET_VERSION}`);
}

async function main() {
  await minifyCss();
  await minifyJs();
  wireHtml();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
