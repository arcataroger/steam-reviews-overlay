// Enumerate every store page reachable from the home page's top menu: each tab's own link plus
// every link its dropdown reveals on hover. Deterministic: tabs are visited in DOM order.
// Usage: node scripts/nav-urls.mjs [out.json]
import { chromium } from 'playwright'
import fs from 'node:fs'

const out = process.argv[2] || 'docs/inventory/nav-urls.json'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, locale: 'en-US' })
await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)

const clean = (href) => {
  const u = new URL(href)
  if (u.hostname !== 'store.steampowered.com') return null
  u.searchParams.delete('snr')
  u.hash = ''
  return u.toString()
}
const allLinks = () => page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => [a.href, (a.textContent || '').replace(/\s+/g, ' ').trim()]))

// The store nav is a React strip of buttons/links just under the global header; find it by the
// item everyone has ("Categories") and take the strip that holds it.
const strip = await page.evaluateHandle(() => {
  const btn = [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').trim() === 'Categories' && e.getBoundingClientRect().top < 150)
  let el = btn
  for (let i = 0; i < 6 && el; i++) {
    el = el.parentElement
    if (el && el.querySelectorAll('button, a').length >= 4) return el
  }
  return btn?.parentElement
})
const items = await strip.evaluate((s) => {
  const seen = []
  for (const e of s.querySelectorAll('button, a')) {
    const t = (e.textContent || '').replace(/\s+/g, ' ').trim()
    if (!t || t.length > 30 || e.querySelector('button, a')) continue
    if (seen.some((x) => x.text === t)) continue
    seen.push({ text: t, href: e.getAttribute('href') || null })
  }
  return seen
})
const result = new Map()
const add = (url, label, group) => {
  const c = clean(url)
  if (c && !result.has(c)) result.set(c, { url: c, label, group })
}
for (const item of items) {
  if (item.href) add(new URL(item.href, 'https://store.steampowered.com/').toString(), item.text, 'tab')
  // A fresh load per tab: an open dropdown otherwise sticks and every later hover reports its links
  await page.goto('https://store.steampowered.com/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const before = new Set((await allLinks()).map(([h]) => h))
  const loc = page.locator('button, a', { hasText: item.text }).filter({ hasText: new RegExp(`^\\s*${item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first()
  if (!(await loc.count())) continue
  await loc.hover()
  await page.waitForTimeout(900)
  let links = (await allLinks()).filter(([h]) => !before.has(h))
  if (!links.length) {
    await loc.click().catch(() => {})
    await page.waitForTimeout(900)
    links = (await allLinks()).filter(([h]) => !before.has(h))
  }
  for (const [h, t] of links) add(h, t, item.text)
}
await browser.close()
const drop = /\/(login|join|logout|account|cart|wishlist|recommender|explore\/$|steamaccount|digitalgiftcards|remoteplay|mobile$|about\/$)/
const list = [...result.values()].filter((e) => !drop.test(e.url + '/') && !/[?&]l=/.test(e.url))
fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true })
fs.writeFileSync(out, JSON.stringify(list, null, 1))
console.log(`${list.length} menu URLs (${result.size - list.length} dropped) → ${out}`)
for (const e of list) console.log(`${e.group.padEnd(18).slice(0, 18)} ${e.label.padEnd(30).slice(0, 30)} ${e.url}`)
