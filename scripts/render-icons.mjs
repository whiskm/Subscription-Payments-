// Renders the SVG app icons to the PNG sizes the PWA, iOS and Android need.
// Uses the Chromium that Playwright drives. Usage: node scripts/render-icons.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is not a project dependency; use the copy installed on the machine.
const { chromium } = createRequire(import.meta.url)('playwright');

const font = readFileSync(new URL('../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2', import.meta.url)).toString('base64');
const svg = (name) => readFileSync(new URL(`../assets/${name}`, import.meta.url), 'utf8');

const jobs = [
  ['icon.svg', 'public/icons/icon-192.png', 192],
  ['icon.svg', 'public/icons/icon-512.png', 512],
  ['icon-maskable.svg', 'public/icons/maskable-512.png', 512],
  ['icon-maskable.svg', 'public/apple-touch-icon.png', 180],
  ['icon.svg', 'assets/icon-only.png', 1024],
  ['icon-maskable.svg', 'assets/icon-foreground.png', 1024],
];

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>@font-face{font-family:Unbounded;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 900}
html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(src)}`);
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(new URL(`../${out}`, import.meta.url), await page.screenshot({ omitBackground: true }));
  console.log(out);
}
await browser.close();
