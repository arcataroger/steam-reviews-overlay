// Assembles the contact sheet from screenshots produced by scripts/screenshots.mjs.
// Usage: node scripts/build-gallery.mjs <shots dir> <out.html>
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const [dir, out] = process.argv.slice(2)
const jpgDir = path.join(dir, 'jpg'); fs.mkdirSync(jpgDir, { recursive: true })
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.png'))) execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', path.join(dir, f), '--out', path.join(jpgDir, f.replace(/\.png$/, '.jpg'))], { stdio: 'ignore' })
const img = (n) => `data:image/jpeg;base64,${fs.readFileSync(path.join(jpgDir, n + '.jpg')).toString('base64')}`
const has = (n) => fs.existsSync(path.join(jpgDir, n + '.jpg'))
const fig = (n, cap, sub = '') => has(n) ? `<figure><img src="${img(n)}" alt="${cap}" loading="lazy"><figcaption><b>${cap}</b>${sub ? `<span>${sub}</span>` : ''}</figcaption></figure>` : ''
const popup = [['popup_parked', 'Both levers parked', 'default: labels only'], ['popup_dim_mixed', 'Dim Mixed and below', 'filter 5 · dim'], ['popup_hide_verypositive', 'Hide Very Positive and below', 'filter 8 · hide'], ['popup_outline_op', 'Outline Overwhelmingly Positive', 'highlight 9'], ['popup_both', 'Dim ≤ Mostly Positive, outline OP', 'filter 6 · highlight 9'], ['popup_my_language', 'Judged by my language', 'source: local'], ['popup_status_ratelimited', 'Rate-limited notice', 'status: 429'], ['popup_status_offline', 'Offline notice', 'status: fetch failed']]
const locales = [['popup_locale_de', 'Deutsch', 'de'], ['popup_locale_fr', 'Français', 'fr'], ['popup_locale_ru', 'Русский', 'ru'], ['popup_locale_pt_BR', 'Português (Brasil)', 'pt_BR'], ['popup_locale_ja', '日本語', 'ja'], ['popup_locale_ko', '한국어', 'ko'], ['popup_locale_zh_CN', '简体中文', 'zh_CN'], ['popup_locale_ar', 'العربية', 'ar · RTL']]
const store = [['labels_only', 'Labels only', 'both levers parked'], ['dim_mixed', 'Dim Mixed and below', 'filter 5 · dim'], ['hide_verypositive', 'Hide Very Positive and below', 'filter 8 · hide'], ['outline_verypositive', 'Outline Very Positive and up', 'highlight 8'], ['both', 'Dim ≤ Mostly Positive + outline OP', 'filter 6 · highlight 9']]
const count = fs.readdirSync(jpgDir).length
const html = `<title>Steam Reviews Overlay Contact Sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500&family=JetBrains+Mono:wght@400&display=swap">
<style>
:root { --bg:#151a21; --surface:#1b2838; --rule:#2a475e; --fg:#c6d4df; --muted:#8f98a0; --accent:#66c0f4; --mixed:#b9a074; --neg:#c85e2d; color-scheme: dark; }
html { background: var(--bg); }
body { margin:0; padding-block: 28px 56px; padding-inline: 24px; background: var(--bg); color: var(--fg); font: 15px/1.5 Barlow, "Segoe UI", Roboto, Arial, sans-serif; }
main { max-width: 1320px; margin: 0 auto; }
header { display:flex; flex-wrap:wrap; align-items:baseline; gap: 10px 22px; padding-bottom: 14px; border-bottom: 1px solid var(--rule); margin-bottom: 8px; }
h1 { margin:0; font: 700 34px/1 "Barlow Condensed", Barlow, sans-serif; letter-spacing: 0.3px; text-wrap: balance; }
header p { margin:0; color: var(--muted); max-width: 62ch; }
.meta { font: 12px/1.4 "JetBrains Mono", Menlo, monospace; color: var(--muted); }
nav { display:flex; flex-wrap:wrap; gap: 6px 18px; margin: 14px 0 30px; font: 500 13px/1 Barlow, sans-serif; text-transform: uppercase; letter-spacing: 1px; }
nav a { color: var(--accent); text-decoration: none; border-bottom: 1px solid transparent; padding-bottom: 3px; }
nav a:hover, nav a:focus-visible { border-color: var(--accent); outline: none; }
section { margin-bottom: 44px; }
h2 { font: 600 22px/1.1 "Barlow Condensed", Barlow, sans-serif; margin: 0 0 4px; display:flex; align-items:baseline; gap: 12px; }
h2 small { font: 12px/1 "JetBrains Mono", Menlo, monospace; color: var(--muted); }
section > p { margin: 0 0 16px; color: var(--muted); max-width: 70ch; }
.grid { display: grid; gap: 18px; }
.popups { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
.stores { grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); }
.mobile { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
figure { margin:0; display:flex; flex-direction:column; gap: 8px; }
figure img { width:100%; height:auto; display:block; border: 1px solid var(--rule); border-radius: 3px; background: var(--surface); }
figcaption { display:flex; flex-direction:column; gap:2px; }
figcaption b { font-weight: 500; }
figcaption span { font: 12px/1.4 "JetBrains Mono", Menlo, monospace; color: var(--muted); }
.legend { display:flex; flex-wrap:wrap; gap: 6px 16px; font: 12px/1 "JetBrains Mono", Menlo, monospace; color: var(--muted); margin-bottom: 16px; }
.legend i { display:inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
@media (max-width: 600px) { body { padding-inline: 16px; } .stores { grid-template-columns: 1fr; } h1 { font-size: 28px; } }
</style>
<main>
<header>
  <h1>Steam Reviews Overlay Contact Sheet</h1>
  <p>Every state of the popup and the overlay, captured from the built Chrome extension against the live store on ${new Date().toISOString().slice(0, 10)}.</p>
  <span class="meta">${count} captures · Chromium headless · 1400×1000 desktop, 360×740 mobile</span>
</header>
<nav><a href="#popup">Popup states</a><a href="#locales">Locales</a><a href="#store">Store pages</a><a href="#mobile">Mobile</a></nav>
<section id="popup"><h2>Popup states <small>filter lever · highlight lever · language · status</small></h2>
  <p>Levers rest on Steam's nine review tiers. Filter is inclusive downward, highlight inclusive upward; the highlight lever always sits at least one tier above the filter and pushes it when dragged past. Parked levers read OFF.</p>
  <div class="grid popups">${popup.map(([n, c, s]) => fig(n, c, s)).join('')}</div></section>
<section id="locales"><h2>Locales <small>8 of 30 · tier labels pulled from Steam per language</small></h2>
  <p>Rendered with the popup's <code>?locale=</code> override. Tier names are the strings Steam itself returns in that language.</p>
  <div class="grid popups">${locales.map(([n, c, s]) => fig(n, c, s)).join('')}</div></section>
<section id="store"><h2>Store pages <small>search results · front page</small></h2>
  <div class="legend"><span><i style="background:var(--accent)"></i>positive</span><span><i style="background:var(--mixed)"></i>mixed</span><span><i style="background:var(--neg)"></i>negative</span><span><i style="background:#929396"></i>no score</span></div>
  <div class="grid stores">${store.flatMap(([k, c, s]) => [fig('search_' + k, `Search · ${c}`, s), fig('front_' + k, `Front page · ${c}`, s)]).join('')}</div></section>
<section id="mobile"><h2>Mobile <small>360×740 · touch emulation · 2× DPR</small></h2>
  <div class="grid mobile">${fig('popup_mobile_360', 'Popup at 360px', 'pointer: coarse')}${fig('search_mobile_360', 'Search results at 360px', 'Steam mobile layout')}</div></section>
</main>`
fs.writeFileSync(out, html)
console.log('gallery:', out, (fs.statSync(out).size / 1048576).toFixed(2), 'MB,', count, 'captures')
