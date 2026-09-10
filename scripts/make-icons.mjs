// Rasterizes the extension icon SVG to public/icon{16,32,48,128}.png using Playwright's Chromium.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2a475e"/><stop offset="1" stop-color="#171d25"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="26" fill="url(#bg)"/>
  <rect x="4" y="4" width="120" height="120" rx="26" fill="none" stroke="#0f151c" stroke-width="3"/>
  <!-- three rising bars: negative, mixed, positive -->
  <rect x="24" y="72" width="22" height="32" rx="5" fill="#a34c25"/>
  <rect x="53" y="52" width="22" height="52" rx="5" fill="#b9a074"/>
  <rect x="82" y="26" width="22" height="78" rx="5" fill="#66c0f4"/>
</svg>`
fs.writeFileSync(path.resolve(import.meta.dirname, '..', 'public', 'icon.svg'), svg.trim() + '\n')

const browser = await chromium.launch()
const page = await browser.newPage()
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  await page.screenshot({ path: path.resolve(import.meta.dirname, '..', 'public', `icon${size}.png`), omitBackground: true })
}
await browser.close()
console.log('icons written')
