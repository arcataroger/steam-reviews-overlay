import {
  loadSettings,
  saveSettings,
  snapThreshold,
  tierFor,
  SETPOINTS,
  type Settings,
  type FilterMode,
  type ScoreSource,
} from '../settings'
import { LANG_KEY, type LangInfo } from '../lang'
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
const includeUnreviewed = $<HTMLInputElement>('#includeUnreviewed')

let settings: Settings

// Flag/language detected by the content script on the last store page visited
ext.storage.local.get(LANG_KEY).then((r) => {
  const l = r?.[LANG_KEY] as LangInfo | undefined
  if (!l) return
  $('#srcFlag').textContent = l.flag
  $('#srcLang').textContent = l.name
})

// Shared notches: left tick zone drives the filter lever, right tick zone the highlight lever.
for (const sp of SETPOINTS) {
  const n = document.createElement('div')
  n.className = `notch ${sp.tone}`
  n.dataset.pct = String(sp.pct)
  n.style.bottom = `${sp.pct}%`
  const tl = document.createElement('div')
  tl.className = 'tick l'
  tl.dataset.side = 'filter'
  const label = document.createElement('span')
  label.textContent = sp.name
  const b = document.createElement('b')
  b.textContent = `${sp.pct}%`
  label.appendChild(b)
  const tr = document.createElement('div')
  tr.className = 'tick r'
  tr.dataset.side = 'highlight'
  n.append(tl, label, tr)
  notches.appendChild(n)
}

function renderSide(side: Side, pct: number) {
  const u = ui[side]
  const tier = tierFor(pct)
  const exact = tier.pct === pct
  // 0% on the left / 100% on the right = feature off
  const off = side === 'filter' ? pct === 0 : pct >= 100
  u.pct.textContent = off ? 'OFF' : `${pct}%`
  u.readout.classList.toggle('off', off)
  u.pct.className = `digits ${off ? 'none' : ''}`
  const c = toneColorAt(pct)
  u.pct.style.setProperty('--c', c)
  u.knob.style.setProperty('--c', c)
  u.tier.textContent = off ? (side === 'filter' ? 'nothing filtered' : 'nothing outlined') : tier.name
  u.tier.className = `tier ${off ? '' : tier.tone}`
  if (!exact && !off) {
    const sub = document.createElement('span')
    sub.className = 'sub'
    sub.textContent = 'between notches'
    u.tier.appendChild(sub)
  }
  u.fill.style.height = side === 'filter' ? `${pct}%` : `${100 - pct}%`
  u.knob.style.setProperty('--pct', String(pct))
  u.knob.className = off ? 'knob parked' : 'knob'
  u.lever.setAttribute('aria-valuenow', String(pct))
  u.lever.setAttribute('aria-valuetext', `${pct}% positive, ${tier.name}`)
  const cls = side === 'filter' ? 'active-l' : 'active-r'
  for (const n of notches.querySelectorAll<HTMLElement>('.notch')) {
    n.classList.toggle(cls, !off && Number(n.dataset.pct) === pct)
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
  includeUnreviewed.checked = settings.includeUnreviewed
}

let saveTimer: number | undefined
function update(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  render()
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveSettings(settings), 100)
}

function setPct(side: Side, raw: number, snap = true) {
  let v = Math.round(Math.min(100, Math.max(0, raw)))
  if (snap) {
    // The OFF detent at the end of each track grabs harder than the tier notches
    if (side === 'filter' && v <= 5) v = 0
    else if (side === 'highlight' && v >= 95 + 3) v = 100
    else v = snapThreshold(v)
  }
  update({ [KEY[side]]: v } as Partial<Settings>)
}

/* --- pointer: drag either lever along its track --- */
function wireLever(side: Side) {
  const { lever } = ui[side]
  const rail = lever.querySelector<HTMLDivElement>('.rail')!
  const pctFromPointer = (clientY: number) => {
    const r = rail.getBoundingClientRect()
    return ((r.bottom - clientY) / r.height) * 100
  }
  lever.addEventListener('pointerdown', (e) => {
    lever.setPointerCapture(e.pointerId)
    setPct(side, pctFromPointer(e.clientY))
    lever.focus()
  })
  lever.addEventListener('pointermove', (e) => {
    if (lever.hasPointerCapture(e.pointerId)) setPct(side, pctFromPointer(e.clientY))
  })
  /* keyboard: arrows ±1, shift ±5, PageUp/Down = next notch, Home/End */
  lever.addEventListener('keydown', (e) => {
    const cur = settings[KEY[side]]
    const step = e.shiftKey ? 5 : 1
    const pts = SETPOINTS.map((s) => s.pct)
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        setPct(side, cur + step, false)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        setPct(side, cur - step, false)
        break
      case 'PageUp':
        setPct(side, pts.find((p) => p > cur) ?? 100, false)
        break
      case 'PageDown':
        setPct(side, [...pts].reverse().find((p) => p < cur) ?? 0, false)
        break
      case 'Home':
        setPct(side, 0, false)
        break
      case 'End':
        setPct(side, 100, false)
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
  setPct(tick.dataset.side as Side, Number(tick.parentElement!.dataset.pct))
})

modeGroup.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]')
  if (b) update({ mode: b.dataset.mode as FilterMode })
})
sourceGroup.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-source]')
  if (b) update({ source: b.dataset.source as ScoreSource })
})
includeUnreviewed.addEventListener('change', () => update({ includeUnreviewed: includeUnreviewed.checked }))

loadSettings().then((s) => {
  settings = s
  render()
})
