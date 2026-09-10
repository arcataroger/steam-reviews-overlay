import { loadSettings, saveSettings, TIERS, type Settings, type FilterMode } from '../settings'

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

const threshold = $<HTMLInputElement>('#threshold')
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

function toneClass(score: number) {
  return score >= 6 ? 'positive' : score === 5 ? 'mixed' : 'negative'
}

function render() {
  threshold.value = String(settings.threshold)
  tierName.textContent = TIERS[settings.threshold]
  tierName.className = `tier ${toneClass(settings.threshold)}`
  for (const b of modeGroup.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode))
  }
  modeHelp.textContent = HELP[settings.mode]
  includeUnreviewed.checked = settings.includeUnreviewed
  const filtering = settings.mode !== 'label'
  threshold.disabled = !filtering
  includeUnreviewed.disabled = !filtering
  document.body.classList.toggle('inactive', !filtering)
}

let saveTimer: number | undefined
function update(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  render()
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveSettings(settings), 100)
}

threshold.addEventListener('input', () => update({ threshold: Number(threshold.value) }))
modeGroup.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]')
  if (b) update({ mode: b.dataset.mode as FilterMode })
})
includeUnreviewed.addEventListener('change', () => update({ includeUnreviewed: includeUnreviewed.checked }))

loadSettings().then((s) => {
  settings = s
  render()
})
