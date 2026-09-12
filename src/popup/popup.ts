import {
  loadSettings,
  saveSettings,
  onSettingsChange,
  snapPosition,
  reconcile,
  posToPct,
  bandEndPct,
  tierFor,
  TIERS,
  OFF_FILTER,
  OFF_HIGHLIGHT,
  type Settings,
  DEFAULT_SETTINGS,
  type FilterMode,
  type ScoreSource,
  mergeIncoming,
} from '../settings'
import { LANG_KEY, detectLang, langForLocale, type LangInfo } from '../lang'
import { GRADIENT_CSS, toneColorAt } from '../tonecolor'
import { t, tierName, tierRule, forceLocale } from '../i18n'
import { STATUS_KEY, type Status } from '../steam'

// QA: /src/popup/index.html?locale=de renders the popup in that catalog regardless of browser locale
const rawLocale = new URLSearchParams(location.search).get('locale')
const qaLocale = rawLocale && /^[a-z]{2,3}(_[A-Za-z0-9]{2,4})?$/.test(rawLocale) ? rawLocale : null
if (qaLocale) await forceLocale(qaLocale)
// Language and direction of the UI, for screen readers and RTL layout
const extApi: typeof chrome | undefined = (globalThis as any).browser ?? (globalThis as any).chrome
document.documentElement.lang = qaLocale?.replace('_', '-') ?? extApi?.i18n?.getUILanguage?.() ?? 'en'
document.documentElement.dir = qaLocale ? (qaLocale === 'ar' ? 'rtl' : 'ltr') : extApi?.i18n?.getMessage?.('@@bidi_dir') || 'ltr'

// Static strings
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!)
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria!))
document.title = t('extName')

/** Shrink an element's font from `max` down to `min` until its text fits its box. */
function fitText(el: HTMLElement, max: number, min: number, slack = 0) {
  const textWidth = () => {
    const r = document.createRange()
    r.selectNodeContents(el)
    return r.getBoundingClientRect().width
  }
  let size = max
  el.style.fontSize = `${size}px`
  while (textWidth() > el.clientWidth - slack && size > min) el.style.fontSize = `${--size}px`
}

// Fit the engraved OFF label inside the parking gate: as large as the locale's word allows
// (English "OFF" gets big letters; Greek "ΑΝΕΝΕΡΓΟ" steps down until it fits).
function fitGateLabels() {
  for (const span of document.querySelectorAll<HTMLElement>('.detent span')) {
    const long = span.textContent!.length > 4
    span.style.letterSpacing = long ? '0.5px' : '2px'
    fitText(span, long ? 10 : 13, 6, 8)
  }
}
fitGateLabels()
// The Dim/Hide switch is 10px type in a ~64px button: long words ("Ausblenden", "Sembunyikan")
// step down to 7px before they would be cut with an ellipsis.
for (const b of document.querySelectorAll<HTMLElement>('.switch button')) fitText(b, 10, 7, 4)

document.documentElement.style.setProperty('--tone-gradient', GRADIENT_CSS)

const ext: typeof chrome = (globalThis as any).browser ?? chrome
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

type Side = 'filter' | 'highlight'
const KEY: Record<Side, 'threshold' | 'highlightThreshold'> = { filter: 'threshold', highlight: 'highlightThreshold' }

const ui = {
  filter: {
    lever: $<HTMLDivElement>('#leverFilter'),
    fill: $<HTMLDivElement>('#fillFilter'),
    knob: $<HTMLDivElement>('#knobFilter'),
    pct: $<HTMLSpanElement>('#pctFilter'),
    tier: $<HTMLSpanElement>('#tierFilter'),
    readout: $<HTMLDivElement>('#readoutFilter'),
  },
  highlight: {
    lever: $<HTMLDivElement>('#leverHighlight'),
    fill: $<HTMLDivElement>('#fillHighlight'),
    knob: $<HTMLDivElement>('#knobHighlight'),
    pct: $<HTMLSpanElement>('#pctHighlight'),
    tier: $<HTMLSpanElement>('#tierHighlight'),
    readout: $<HTMLDivElement>('#readoutHighlight'),
  },
}
const notches = $<HTMLDivElement>('#notches')
const modeGroup = $<HTMLDivElement>('#mode')
const sourceGroup = $<HTMLDivElement>('#source')

let settings: Settings = { ...DEFAULT_SETTINGS }
let loaded = false

/* Track geometry: tier 1..9 -> 0..100% of track; a parked handle sits GATE units beyond each end. */
const trackPct = (pos: number) => ((pos - 1) / 8) * 100
const GATE_L = -12
const GATE_R = 112

// Flag/language: what the content script detected on the last store page (Steam_Language cookie),
// falling back to the browser locale until a store page has been visited.
function showLang(l: LangInfo) {
  $('#srcFlag').textContent = l.flag
  const local = document.querySelector<HTMLButtonElement>('#source [data-source="local"]')!
  const global = document.querySelector<HTMLButtonElement>('#source [data-source="global"]')!
  local.title = `${t('myLanguage')} (${l.name})`
  local.setAttribute('aria-label', local.title)
  global.title = t('allLanguages')
  global.setAttribute('aria-label', global.title)
}
showLang(qaLocale ? langForLocale(qaLocale) : detectLang())
if (!qaLocale) {
  ext.storage.local.get(LANG_KEY).then((r) => {
    const l = r?.[LANG_KEY] as LangInfo | undefined
    if (l) showLang(l)
  })
}

/** A numeric fragment ("70–79%", "500+", "≤ 69%") as an LTR bidi isolate: in an RTL paragraph the
 *  bidi algorithm would otherwise reorder the operators and dashes around the digits. */
function ltrToken(text: string): HTMLElement {
  const el = document.createElement('bdi')
  el.dir = 'ltr'
  el.textContent = text
  return el
}
const NUMERIC_RUN = /[+≤≥]?\d[\d.,]*(?:\s*[–\-]\s*\d[\d.,]*)?(?:\s*%)?\+?/g
/** Set text, isolating every numeric run so ranges and counts read correctly in RTL locales. */
function setTextWithNumbers(el: HTMLElement, text: string) {
  el.textContent = ''
  let last = 0
  for (const m of text.matchAll(NUMERIC_RUN)) {
    if (m.index! > last) el.appendChild(document.createTextNode(text.slice(last, m.index)))
    el.appendChild(ltrToken(m[0]))
    last = m.index! + m[0].length
  }
  if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)))
}

// One notch per Steam tier. Left tick zone drives the filter lever, right tick zone the highlight lever.
for (const tier of TIERS) {
  const n = document.createElement('div')
  n.className = `notch ${tier.tone}`
  n.dataset.pos = String(tier.score)
  n.style.bottom = `${trackPct(tier.score)}%`
  const tl = document.createElement('div')
  tl.className = 'tick l'
  tl.dataset.side = 'filter'
  tl.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  label.textContent = tierName(tier.score)
  const b = document.createElement('b')
  setTextWithNumbers(b, tierRule(tier.score))
  label.appendChild(b)
  const tr = document.createElement('div')
  tr.className = 'tick r'
  tr.dataset.side = 'highlight'
  tr.setAttribute('aria-hidden', 'true')
  n.append(tl, label, tr)
  notches.appendChild(n)
}

function renderSide(side: Side, value: number) {
  const u = ui[side]
  const off = side === 'filter' ? value <= OFF_FILTER : value >= OFF_HIGHLIGHT
  const pos = off ? (side === 'filter' ? 1 : 9) : value
  const tier = tierFor(pos)
  u.readout.classList.toggle('off', off)
  // Both inclusive: filter covers the tier and below, so its number is the top of the tier's band
  // (Mixed 40–69% → "≤ 69%"); highlight covers the tier and above, so its number is the band start
  // (Positive 80%+ → "≥ 80%").
  const pct = side === 'filter' ? bandEndPct(pos) : Math.round(posToPct(pos))
  // The formula sits in a <bdi dir="ltr"> so RTL locales neither mirror ≤ into ≥ nor reorder it,
  // while the box itself still aligns logically with its title.
  if (off) u.pct.textContent = t('off')
  else {
    u.pct.textContent = ''
    u.pct.appendChild(ltrToken(`${side === 'filter' ? '≤' : '≥'} ${pct}%`))
  }
  u.pct.className = `digits ${off ? 'none' : ''}`
  u.tier.textContent = tierName(tier.score)
  u.tier.className = `tier ${off ? '' : tier.tone}`
  const c = toneColorAt(pos)
  if (off) u.pct.style.removeProperty('--c')
  else u.pct.style.setProperty('--c', c)
  u.knob.style.setProperty('--c', c)
  u.fill.style.setProperty('--pct', String(off ? (side === 'filter' ? 0 : 100) : trackPct(pos)))
  u.fill.classList.toggle('off', off)
  u.knob.style.setProperty('--pct', String(off ? (side === 'filter' ? GATE_L : GATE_R) : trackPct(pos)))
  u.knob.className = off ? 'knob parked' : 'knob'
  u.lever.setAttribute('aria-valuenow', String(off ? (side === 'filter' ? 0 : 10) : pos))
  u.lever.setAttribute('aria-valuetext', off ? t('off') : tierName(tier.score))
  const cls = side === 'filter' ? 'active-l' : 'active-r'
  for (const n of notches.querySelectorAll<HTMLElement>('.notch')) {
    n.classList.toggle(cls, !off && Number(n.dataset.pos) === pos)
  }
  // a parked lever's side of the ladder goes dark
  notches.classList.toggle(side === 'filter' ? 'off-l' : 'off-r', off)
}

function render() {
  renderSide('filter', settings.threshold)
  renderSide('highlight', settings.highlightThreshold)
  // Radio groups: the checked item is the group's single tab stop (roving tabindex)
  for (const b of modeGroup.querySelectorAll<HTMLButtonElement>('button')) {
    const on = b.dataset.mode === settings.mode
    b.setAttribute('aria-checked', String(on))
    b.tabIndex = on ? 0 : -1
  }
  for (const b of sourceGroup.querySelectorAll<HTMLButtonElement>('button')) {
    const on = b.dataset.source === settings.source
    b.setAttribute('aria-checked', String(on))
    b.tabIndex = on ? 0 : -1
  }
}

/** Arrow keys move the selection within a radio group, as the radiogroup role promises. */
function radioKeys(group: HTMLElement, pick: (b: HTMLButtonElement) => void) {
  group.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    const buttons = [...group.querySelectorAll<HTMLButtonElement>('button')]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    // In an RTL layout the visual left/right are swapped; DOM order follows the reading direction
    const rtl = document.documentElement.dir === 'rtl'
    const forward = e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (forward ? 1 : buttons.length - 1)) % buttons.length
    e.preventDefault()
    buttons[next].focus()
    pick(buttons[next])
  })
}
radioKeys(modeGroup, (b) => update({ mode: b.dataset.mode as FilterMode }))
radioKeys(sourceGroup, (b) => update({ source: b.dataset.source as ScoreSource }))

let saveTimer: number | undefined
let pendingSave: Settings | null = null
/** Which settings this window is editing right now, and which lever (if any) is under the pointer.
 *  Recorded as the edits happen rather than worked out later by diffing: see mergeIncoming. */
let dirtyKeys = new Set<keyof Settings>()
let dirtySide: Side | null = null
function flush() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (!pendingSave) return
  const s = pendingSave
  pendingSave = null
  dirtyKeys = new Set()
  dirtySide = null
  void saveSettings(s)
}
/** Discrete changes save immediately; drags (`defer`) coalesce and flush on release or popup close.
 *  `keys` names what the user is changing when the patch is a whole settings object; `side` names
 *  the lever they are holding. */
function update(
  patch: Partial<Settings>,
  { defer = false, keys, side }: { defer?: boolean; keys?: (keyof Settings)[]; side?: Side } = {},
) {
  if (!loaded) return
  settings = { ...settings, ...patch }
  for (const k of keys ?? (Object.keys(patch) as (keyof Settings)[])) dirtyKeys.add(k)
  if (side) dirtySide = side
  render()
  pendingSave = settings
  clearTimeout(saveTimer)
  if (defer) saveTimer = window.setTimeout(flush, 100)
  else flush()
}

window.addEventListener('pagehide', flush)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flush()
})
// Changes from elsewhere (another popup window, sync from another device) while we're open. A drag
// still in flight keeps the keys it is moving; everything else takes the incoming value.
onSettingsChange((s) => {
  if (pendingSave) {
    settings = mergeIncoming(s, settings, dirtyKeys, dirtySide)
    pendingSave = settings
  } else {
    settings = s
  }
  render()
})

/** `raw` is a ladder position (1..9) that may run past the ends into the gates; always snaps to a tier.
 *  Moving one lever past the other pushes the other along (highlight never sits below filter). */
function setPos(side: Side, raw: number, opts: { defer?: boolean } = {}) {
  if (!loaded) return
  let v: number
  if (side === 'filter' && raw <= 0.6) v = OFF_FILTER
  else if (side === 'highlight' && raw >= 9.4) v = OFF_HIGHLIGHT
  else v = snapPosition(raw)
  const next = reconcile({ ...settings, [KEY[side]]: v }, side)
  const pushed = side === 'filter' ? next.highlightThreshold !== settings.highlightThreshold : next.threshold !== settings.threshold
  // `next` is a whole settings object, so say which keys the user is actually moving: the lever
  // under the pointer, and its sibling only while this move is pushing it along.
  update(next, { ...opts, side, keys: pushed ? ['threshold', 'highlightThreshold'] : [KEY[side]] })
  if (pushed) {
    const other = ui[side === 'filter' ? 'highlight' : 'filter'].knob
    other.classList.add('pushed')
    setTimeout(() => other.classList.remove('pushed'), 250)
  }
}

/* --- pointer: drag either lever along its track --- */
function wireLever(side: Side) {
  const { lever } = ui[side]
  const rail = lever.querySelector<HTMLDivElement>('.rail')!
  lever.setAttribute('aria-valuemin', side === 'filter' ? String(OFF_FILTER) : '1')
  lever.setAttribute('aria-valuemax', side === 'filter' ? '9' : String(OFF_HIGHLIGHT))
  lever.setAttribute('aria-orientation', 'vertical')
  const posFromPointer = (clientY: number) => {
    // The rail runs --gate px past each end tier; derive that from geometry so the mapping is exact
    const r = rail.getBoundingClientRect()
    const trackPx = parseFloat(getComputedStyle(lever.parentElement!).getPropertyValue('--track')) || 250
    const gatePct = ((r.height - trackPx) / 2 / trackPx) * 100
    const frac = (r.bottom - clientY) / r.height // 0..1 across the whole rail
    const pct = -gatePct + frac * (100 + 2 * gatePct)
    return 1 + (pct / 100) * 8
  }
  lever.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary || !loaded) return
    lever.setPointerCapture(e.pointerId)
    setPos(side, posFromPointer(e.clientY), { defer: true })
    lever.focus()
  })
  lever.addEventListener('pointermove', (e) => {
    if (lever.hasPointerCapture(e.pointerId)) setPos(side, posFromPointer(e.clientY), { defer: true })
  })
  lever.addEventListener('pointerup', () => flush())
  lever.addEventListener('lostpointercapture', () => flush())
  /* keyboard: arrows and PageUp/Down step one tier, Home/End park the lever */
  lever.addEventListener('keydown', (e) => {
    const cur = settings[KEY[side]]
    const lo = side === 'filter' ? OFF_FILTER : 1
    const hi = side === 'highlight' ? OFF_HIGHLIGHT : 9
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
      case 'PageUp':
        setPos(side, cur >= 9 ? hi : cur + 1)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'PageDown':
        setPos(side, cur <= 1 ? lo : cur - 1)
        break
      case 'Home':
        setPos(side, lo)
        break
      case 'End':
        setPos(side, hi)
        break
      default:
        return
    }
    e.preventDefault()
  })
}
wireLever('filter')
wireLever('highlight')

notches.addEventListener('click', (e) => {
  const tick = (e.target as HTMLElement).closest<HTMLElement>('.tick[data-side]')
  if (!tick) return
  setPos(tick.dataset.side as Side, Number(tick.parentElement!.dataset.pos))
})

modeGroup.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]')
  if (b) update({ mode: b.dataset.mode as FilterMode })
})
sourceGroup.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-source]')
  if (b) update({ source: b.dataset.source as ScoreSource })
})

loadSettings().then((s) => {
  settings = s
  loaded = true
  document.querySelector('.panel')?.removeAttribute('aria-busy')
  render()
})

/* --- status banner: friendly errors from the content script, or a hint when not on the store --- */
const statusEl = $<HTMLDivElement>('#status')
function showStatus(text: string | null, kind: 'info' | 'warn' = 'warn') {
  // Keep the live region in the tree (an element that is hidden when text lands isn't announced)
  statusEl.className = `status ${kind}`
  statusEl.textContent = text ?? ''
  document.body.classList.toggle('has-notice', !!text)
}
async function refreshStatus() {
  try {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true })
    const onStore = !!tab?.url && /^https:\/\/store\.steampowered\.com\//.test(tab.url)
    if (!onStore) return showStatus(t('errNotStore'), 'info')
    const r = await ext.storage.local.get(STATUS_KEY)
    const st = r?.[STATUS_KEY] as Status | undefined
    if (!st || st.kind === 'ok' || Date.now() - st.ts > 5 * 60_000) return showStatus(null)
    showStatus(st.kind === 'offline' ? t('errOffline') : st.kind === 'rate' ? t('errRateLimited') : t('errSteam'))
  } catch {
    showStatus(null)
  }
}
void refreshStatus()
ext.storage.onChanged.addListener((c) => {
  if (c[STATUS_KEY]) void refreshStatus()
})
