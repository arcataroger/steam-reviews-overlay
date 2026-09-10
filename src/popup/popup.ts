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

const threshold = $<HTMLInputElement>('#threshold')
const tierName = $<HTMLSpanElement>('#tierName')
const chips = $<HTMLDivElement>('#chips')
const datalist = $<HTMLDataListElement>('#setpoints')
const modeGroup = $<HTMLDivElement>('#mode')
const modeHelp = $<HTMLParagraphElement>('#modeHelp')
const includeUnreviewed = $<HTMLInputElement>('#includeUnreviewed')

const HELP: Record<FilterMode, string> = {
  label: 'Only show the review summary on each game. Nothing is filtered.',
  dim: 'Darken games below the bar with a black overlay. Still clickable.',
  hide: 'Collapse games below the bar so they disappear from lists and grids.',
}

let settings: Settings

// Build the tier chips + slider tick marks once
for (const sp of SETPOINTS) {
  if (sp.pct === 0) continue // "Negative" starts at 0%: nothing can be under it
  const b = document.createElement('button')
  b.type = 'button'
  b.className = sp.tone
  b.dataset.pct = String(sp.pct)
  b.innerHTML = `${sp.name}<span class="p">${sp.pct}%</span>`
  chips.appendChild(b)
  const o = document.createElement('option')
  o.value = String(sp.pct)
  datalist.appendChild(o)
}

function render() {
  threshold.value = String(settings.threshold)
  const tier = tierFor(settings.threshold)
  const exact = tier.pct === settings.threshold
  tierName.className = `tier ${tier.tone}`
  tierName.innerHTML = exact
    ? `${tier.name}<span class="pct">${settings.threshold}%</span>`
    : `${settings.threshold}% positive<span class="pct">(${tier.name})</span>`
  for (const c of chips.querySelectorAll<HTMLButtonElement>('button')) {
    c.classList.toggle('active', Number(c.dataset.pct) === settings.threshold)
  }
  for (const b of modeGroup.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode))
  }
  modeHelp.textContent = HELP[settings.mode]
  includeUnreviewed.checked = settings.includeUnreviewed
  const filtering = settings.mode !== 'label'
  threshold.disabled = !filtering
  includeUnreviewed.disabled = !filtering
  for (const c of chips.querySelectorAll<HTMLButtonElement>('button')) c.disabled = !filtering
  document.body.classList.toggle('inactive', !filtering)
}

let saveTimer: number | undefined
function update(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  render()
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveSettings(settings), 100)
}

threshold.addEventListener('input', () => update({ threshold: snapThreshold(Number(threshold.value)) }))
chips.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-pct]')
  if (b) update({ threshold: Number(b.dataset.pct) })
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
