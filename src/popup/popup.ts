import {
  loadSettings,
  saveSettings,
  snapThreshold,
  tierFor,
  SETPOINTS,
  type Settings,
  type FilterMode,
} from '../settings'

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

const lever = $<HTMLDivElement>('#lever')
const rail = lever.querySelector<HTMLDivElement>('.rail')!
const fill = $<HTMLDivElement>('#fill')
const knob = $<HTMLDivElement>('#knob')
const notches = $<HTMLDivElement>('#notches')
const pctReadout = $<HTMLSpanElement>('#pctReadout')
const tierName = $<HTMLSpanElement>('#tierName')
const modeGroup = $<HTMLDivElement>('#mode')
const modeHelp = $<HTMLParagraphElement>('#modeHelp')
const includeUnreviewed = $<HTMLInputElement>('#includeUnreviewed')

const HELP: Record<FilterMode, string> = {
  label: 'Only show the review summary on each game. Nothing is filtered.',
  dim: 'Darken games below the bar with a black overlay. Still clickable.',
  hide: 'Collapse games below the bar so they disappear from lists and grids.',
}

let settings: Settings

// One notch + label per named tier, positioned at its real percentage.
for (const sp of SETPOINTS) {
  const n = document.createElement('div')
  n.className = `notch ${sp.tone}`
  n.dataset.pct = String(sp.pct)
  n.style.bottom = `${sp.pct}%`
  n.innerHTML = `<span>${sp.name}<b>${sp.pct}%</b></span>`
  notches.appendChild(n)
}

function render() {
  const pct = settings.threshold
  const tier = tierFor(pct)
  const exact = tier.pct === pct
  pctReadout.textContent = `${pct}%`
  tierName.className = `tier ${tier.tone}`
  tierName.innerHTML = exact ? tier.name : `${tier.name}<span class="sub">between notches</span>`
  fill.style.height = `${pct}%`
  knob.style.bottom = `${pct}%`
  knob.className = `knob ${tier.tone}`
  lever.setAttribute('aria-valuenow', String(pct))
  lever.setAttribute('aria-valuetext', `${pct}% positive, ${tier.name}`)
  for (const n of notches.querySelectorAll<HTMLElement>('.notch')) {
    n.classList.toggle('active', Number(n.dataset.pct) === pct)
  }
  for (const b of modeGroup.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode))
  }
  modeHelp.textContent = HELP[settings.mode]
  includeUnreviewed.checked = settings.includeUnreviewed
  const filtering = settings.mode !== 'label'
  includeUnreviewed.disabled = !filtering
  lever.tabIndex = filtering ? 0 : -1
  lever.setAttribute('aria-disabled', String(!filtering))
  document.body.classList.toggle('inactive', !filtering)
}

let saveTimer: number | undefined
function update(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  render()
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveSettings(settings), 100)
}

function setThreshold(raw: number, snap = true) {
  const v = Math.round(Math.min(100, Math.max(0, raw)))
  update({ threshold: snap ? snapThreshold(v) : v })
}

/* --- pointer: drag the lever anywhere along the track --- */
function pctFromPointer(clientY: number): number {
  const r = rail.getBoundingClientRect()
  return ((r.bottom - clientY) / r.height) * 100
}
lever.addEventListener('pointerdown', (e) => {
  const notch = (e.target as HTMLElement).closest<HTMLElement>('.notch')
  if (notch) {
    setThreshold(Number(notch.dataset.pct))
    return
  }
  lever.setPointerCapture(e.pointerId)
  setThreshold(pctFromPointer(e.clientY))
  lever.focus()
})
lever.addEventListener('pointermove', (e) => {
  if (lever.hasPointerCapture(e.pointerId)) setThreshold(pctFromPointer(e.clientY))
})

/* --- keyboard: arrows ±1, shift ±5, PageUp/Down = next notch, Home/End --- */
lever.addEventListener('keydown', (e) => {
  const cur = settings.threshold
  const step = e.shiftKey ? 5 : 1
  const pts = SETPOINTS.map((s) => s.pct)
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      setThreshold(cur + step, false)
      break
    case 'ArrowDown':
    case 'ArrowLeft':
      setThreshold(cur - step, false)
      break
    case 'PageUp':
      setThreshold(pts.find((p) => p > cur) ?? 100, false)
      break
    case 'PageDown':
      setThreshold([...pts].reverse().find((p) => p < cur) ?? 0, false)
      break
    case 'Home':
      setThreshold(0, false)
      break
    case 'End':
      setThreshold(100, false)
      break
    default:
      return
  }
  e.preventDefault()
})

modeGroup.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]')
  if (b) update({ mode: b.dataset.mode as FilterMode })
})
includeUnreviewed.addEventListener('change', () => update({ includeUnreviewed: includeUnreviewed.checked }))

loadSettings().then((s) => {
  settings = s
  render()
})
