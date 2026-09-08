import { chromium } from 'playwright';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const [, , name, bg] = process.argv;
const html = `<!doctype html><html><body style="margin:0;background:${bg || '#111'}"><img src="${name}.png" style="width:1024px;height:1024px;display:block"></body></html>`;
writeFileSync(path.join('out', `${name}-preview.html`), html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1024, height: 1024 });
await page.goto(`file://${path.resolve('out', `${name}-preview.html`)}`);
await page.waitForTimeout(200);
await page.screenshot({ path: path.join('out', `${name}-preview.png`) });
await browser.close();
console.log(`out/${name}-preview.png`);
