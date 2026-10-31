// Renders header.html to docs/images/shelflife-header.png (1280 × 640) with Playwright:
//   npm i -D playwright && npx playwright install chromium && node docs/images/source/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, 'header.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(here, '..', 'shelflife-header.png') });
await browser.close();
console.log('Wrote docs/images/shelflife-header.png');
