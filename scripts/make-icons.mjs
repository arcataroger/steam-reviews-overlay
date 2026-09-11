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
    <linearGradient id="knob" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9fb0c4"/><stop offset="1" stop-color="#4c5a6c"/>
    </linearGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b9a074"/><stop offset="1" stop-color="#c85e2d"/>
    </linearGradient>
    <linearGradient id="cool" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#66c0f4"/><stop offset="1" stop-color="#7f97b0"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="26" fill="url(#bg)"/>
  <rect x="4" y="4" width="120" height="120" rx="26" fill="none" stroke="#0f151c" stroke-width="3"/>
  <!-- filter lever (left): filled from the bottom up to its handle -->
  <rect x="30" y="16" width="20" height="96" rx="10" fill="#0c1117"/>
  <rect x="34" y="74" width="12" height="34" rx="6" fill="url(#warm)"/>
  <rect x="20" y="66" width="40" height="20" rx="6" fill="url(#knob)" stroke="#1a2029" stroke-width="2"/>
  <!-- highlight lever (right): filled from the top down to its handle -->
  <rect x="78" y="16" width="20" height="96" rx="10" fill="#0c1117"/>
  <rect x="82" y="20" width="12" height="34" rx="6" fill="url(#cool)"/>
  <rect x="68" y="44" width="40" height="20" rx="6" fill="url(#knob)" stroke="#1a2029" stroke-width="2"/>
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
