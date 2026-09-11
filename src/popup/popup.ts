import {
  loadSettings,
  saveSettings,
  snapPosition,
  posToPct,
  tierFor,
  TIERS,
  OFF_FILTER,
  OFF_HIGHLIGHT,
  type Settings,
  type FilterMode,
  type ScoreSource,
} from '../settings'
import { LANG_KEY, detectLang, langForLocale, type LangInfo } from '../lang'
import { GRADIENT_CSS, toneColorAt } from '../tonecolor'
import { t, tierName, tierRule, forceLocale } from '../i18n'
import { STATUS_KEY, type Status } from '../steam'

// QA: /src/popup/index.html?locale=de renders the popup in that catalog regardless of browser locale
const qaLocale = new URLSearchParams(location.search).get('locale')
if (qaLocale) await forceLocale(qaLocale)
if (qaLocale === 'ar') document.documentElement.dir = 'rtl'

// Static strings
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!)
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria!))
document.title = t('extName')

// Fit the engraved OFF label inside the parking gate: as large as the locale's word allows
// (English "OFF" gets big letters; Greek "ΑΝΕΝΕΡΓΟ" steps down until it fits).
function fitGateLabels() {
  for (const span of document.querySelectorAll<HTMLElement>('.detent span')) {
    const long = span.textContent!.length > 4
    span.style.letterSpacing = long ? '0.5px' : '2px'
    const textWidth = () => {
      const r = document.createRange()
      r.selectNodeContents(span)
      return r.getBoundingClientRect().width
    }
    let size = long ? 10 : 13
    span.style.fontSize = `${size}px`
    while (textWidth() > span.clientWidth - 8 && size > 6) span.style.fontSize = `${--size}px`
  }
}
fitGateLabels()

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

let settings: Settings

/* Track geometry: tier 1..9 -> 0..100% of track; gates sit GATE units beyond each end. */
const trackPct = (pos: number) => ((pos - 1) / 8) * 100
const GATE_L = -12
const GATE_R = 112

// Flag/language: what the content script detected on the last store page (Steam_Language cookie),
// falling back to the browser locale until a store page has been visited.
function showLang(l: LangInfo) {
  $('#srcFlag').textContent = l.flag
  $('#srcLang').textContent = `(${l.name})`
}
showLang(qaLocale ? langForLocale(qaLocale) : detectLang())
if (!qaLocale) {
  ext.storage.local.get(LANG_KEY).then((r) => {
    const l = r?.[LANG_KEY] as LangInfo | undefined
    if (l) showLang(l)
  })
}

// One notch per Steam tier. Left tick zone drives the filter lever, right tick zone the highlight lever.
for (const t of TIERS) {
  const n = document.createElement('div')
  n.className = `notch ${t.tone}`
  n.dataset.pos = String(t.score)
  n.style.bottom = `${trackPct(t.score)}%`
  const tl = document.createElement('div')
  tl.className = 'tick l'
  tl.dataset.side = 'filter'
  const label = document.createElement('span')
  label.textContent = tierName(t.score)
  const b = document.createElement('b')
  b.textContent = tierRule(t.score)
  label.appendChild(b)
  const tr = document.createElement('div')
  tr.className = 'tick r'
  tr.dataset.side = 'highlight'
  n.append(tl, label, tr)
  notches.appendChild(n)
}

function renderSide(side: Side, value: number) {
  const u = ui[side]
  const off = side === 'filter' ? value <= OFF_FILTER : value >= OFF_HIGHLIGHT
  const pos = off ? (side === 'filter' ? 1 : 9) : value
  const tier = tierFor(pos)
  u.readout.classList.toggle('off', off)
  u.pct.textContent = off ? t('off') : `${Math.round(posToPct(pos))}%`
  u.pct.className = `digits ${off ? 'none' : ''}`
  u.tier.textContent = tierName(tier.score)
  u.tier.className = `tier ${off ? '' : tier.tone}`
  const c = toneColorAt(pos)
  if (off) u.pct.style.removeProperty('--c')
  else u.pct.style.setProperty('--c', c)
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
}

function render() {
  renderSide('filter', settings.threshold)
  renderSide('highlight', settings.highlightThreshold)
  for (const b of modeGroup.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode))
  }
  for (const b of sourceGroup.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-checked', String(b.dataset.source === settings.source))
  }
}

let saveTimer: number | undefined
function update(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  render()
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveSettings(settings), 100)
}

/** `raw` is a ladder position (1..9) that may run past the ends into the gates; always snaps to a tier. */
function setPos(side: Side, raw: number) {
  let v: number
  if (side === 'filter' && raw <= 0.6) v = OFF_FILTER
  else if (side === 'highlight' && raw >= 9.4) v = OFF_HIGHLIGHT
  else v = snapPosition(raw)
  update({ [KEY[side]]: v } as Partial<Settings>)
}

/* --- pointer: drag either lever along its track --- */
function wireLever(side: Side) {
  const { lever } = ui[side]
  const rail = lever.querySelector<HTMLDivElement>('.rail')!
  const posFromPointer = (clientY: number) => {
    // rail spans GATE_L..GATE_R in track units
    const r = rail.getBoundingClientRect()
    const t = (r.bottom - clientY) / r.height // 0..1 across the whole rail
    const pct = GATE_L + t * (GATE_R - GATE_L)
    return 1 + (pct / 100) * 8
  }
  lever.addEventListener('pointerdown', (e) => {
    lever.setPointerCapture(e.pointerId)
    setPos(side, posFromPointer(e.clientY))
    lever.focus()
  })
  lever.addEventListener('pointermove', (e) => {
    if (lever.hasPointerCapture(e.pointerId)) setPos(side, posFromPointer(e.clientY))
  })
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
  render()
})

/* --- status banner: friendly errors from the content script, or a hint when not on the store --- */
const statusEl = $<HTMLDivElement>('#status')
function showStatus(text: string | null, kind: 'info' | 'warn' = 'warn') {
  statusEl.hidden = !text
  statusEl.textContent = text ?? ''
  statusEl.className = `status ${kind}`
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
