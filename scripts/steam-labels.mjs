/**
 * Pull Steam's own localized review labels ("Very Positive", "褒贬不一", ...) for every Steam
 * language and write them into _locales/<locale>/messages.json as tier1..tier9, so the
 * popup uses exactly the strings Steam shows in that language.
 *
 * Usage: node --experimental-strip-types scripts/steam-labels.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { encodeGetItemsRequest } from '../src/proto.ts'

// One app per review_score, found by sampling the store (see git history for the finder).
const APP_FOR_SCORE = { 1: 792990, 2: 2321101, 3: 570690, 4: 954850, 5: 3023190, 6: 443580, 7: 654080, 8: 570, 9: 1302800 }

const LOCALES = {
  en: 'english', zh_CN: 'schinese', zh_TW: 'tchinese', ja: 'japanese', ko: 'koreana', ru: 'russian', de: 'german',
  fr: 'french', es: 'spanish', es_419: 'latam', pt_BR: 'brazilian', pt_PT: 'portuguese', it: 'italian', pl: 'polish',
  tr: 'turkish', th: 'thai', vi: 'vietnamese', uk: 'ukrainian', nl: 'dutch', sv: 'swedish', da: 'danish', no: 'norwegian',
  fi: 'finnish', cs: 'czech', hu: 'hungarian', ro: 'romanian', bg: 'bulgarian', el: 'greek', id: 'indonesian', ar: 'arabic',
}

const root = path.resolve(import.meta.dirname, '..')
const ids = Object.values(APP_FOR_SCORE)
let changed = 0
for (const [locale, lang] of Object.entries(LOCALES)) {
  const enc = encodeGetItemsRequest(ids, { country: 'US', language: lang })
  const r = await fetch('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?format=json&input_protobuf_encoded=' + encodeURIComponent(enc))
  if (!r.ok) throw new Error(`${lang}: HTTP ${r.status}`)
  const j = await r.json()
  const labels = {}
  for (const it of j.response?.store_items ?? []) {
    const sf = it.reviews?.summary_filtered
    if (sf?.review_score) labels[sf.review_score] = sf.review_score_label
  }
  const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((s) => !labels[s])
  if (missing.length) throw new Error(`${lang}: no label for scores ${missing.join(',')} (a sample app changed tier; update APP_FOR_SCORE)`)
  const file = path.join(root, '_locales', locale, 'messages.json')
  const cat = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (let s = 1; s <= 9; s++) {
    if (cat[`tier${s}`]?.message !== labels[s]) {
      cat[`tier${s}`] = { ...(cat[`tier${s}`] ?? {}), message: labels[s] }
      changed++
    }
  }
  fs.writeFileSync(file, JSON.stringify(cat, null, 2) + '\n')
  console.log(locale.padEnd(6), Object.values(labels).join(' | '))
  await new Promise((r) => setTimeout(r, 150))
}
console.log(`updated ${changed} tier labels`)
