import {
  loadSettings,
  saveSettings,
  snapPosition,
  posToPct,
  tierFor,
  hasPercentGap,
  TIERS,
  OFF_FILTER,
  OFF_HIGHLIGHT,
  type Settings,
  type FilterMode,
  type ScoreSource,
} from '../settings'
import { LANG_KEY, detectLang, type LangInfo } from '../lang'
import { GRADIENT_CSS, toneColorAt } from '../tonecolor'

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
showLang(detectLang())
ext.storage.local.get(LANG_KEY).then((r) => {
  const l = r?.[LANG_KEY] as LangInfo | undefined
  if (l) showLang(l)
})

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
  label.textContent = t.name
  const b = document.createElement('b')
  b.textContent = t.rule
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
  const onTier = Number.isInteger(pos)
  u.readout.classList.toggle('off', off)
  u.pct.textContent = off ? 'OFF' : `${Math.round(posToPct(pos))}%`
  u.pct.className = `digits ${off ? 'none' : ''}`
  u.tier.textContent = onTier ? tier.name : `${tier.name} +`
  u.tier.className = `tier ${off ? '' : tier.tone}`
  if (!onTier && !off) {
    const sub = document.createElement('span')
    sub.className = 'sub'
    sub.textContent = 'between tiers'
    u.tier.appendChild(sub)
  }
  const c = toneColorAt(pos)
  if (off) u.pct.style.removeProperty('--c')
  else u.pct.style.setProperty('--c', c)
  u.fill.style.setProperty('--pct', String(off ? (side === 'filter' ? 0 : 100) : trackPct(pos)))
  u.fill.classList.toggle('off', off)
  u.knob.style.setProperty('--pct', String(off ? (side === 'filter' ? GATE_L : GATE_R) : trackPct(pos)))
  u.knob.className = off ? 'knob parked' : 'knob'
  u.lever.setAttribute('aria-valuenow', String(off ? (side === 'filter' ? 0 : 10) : pos))
  u.lever.setAttribute('aria-valuetext', off ? 'off' : onTier ? tier.name : `${Math.round(posToPct(pos))}% positive`)
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

/** `raw` is a ladder position (1..9) that may run past the ends into the gates. */
function setPos(side: Side, raw: number, snap = true) {
  let v: number
  if (side === 'filter' && raw <= (snap ? 0.6 : 0.99)) v = OFF_FILTER
  else if (side === 'highlight' && raw >= (snap ? 9.4 : 9.01)) v = OFF_HIGHLIGHT
  else v = snap ? snapPosition(raw) : Math.min(9, Math.max(1, Math.round(raw * 100) / 100))
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
  /* keyboard: arrows step by tier (or 1% within a percent gap with shift), PageUp/Down = next tier, Home/End = gates */
  lever.addEventListener('keydown', (e) => {
    const cur = settings[KEY[side]]
    const lo = side === 'filter' ? OFF_FILTER : 1
    const hi = side === 'highlight' ? OFF_HIGHLIGHT : 9
    const fine = e.shiftKey
    const stepUp = () => {
      if (cur >= 9) return hi
      const base = Math.floor(cur)
      if (fine && hasPercentGap(base)) {
        const span = posToPct(base + 1) - posToPct(base)
        return Math.min(base + 1, cur + 1 / span)
      }
      return Math.floor(cur) + 1
    }
    const stepDown = () => {
      if (cur <= 1) return lo
      const base = Number.isInteger(cur) ? cur - 1 : Math.floor(cur)
      if (fine && hasPercentGap(base)) {
        const span = posToPct(base + 1) - posToPct(base)
        return Math.max(base, cur - 1 / span)
      }
      return base
    }
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
      case 'PageUp':
        setPos(side, stepUp(), false)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'PageDown':
        setPos(side, stepDown(), false)
        break
      case 'Home':
        setPos(side, lo, false)
        break
      case 'End':
        setPos(side, hi, false)
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
