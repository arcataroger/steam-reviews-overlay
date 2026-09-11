/** Thin wrapper over the WebExtension i18n API with a dev/test fallback to the English catalog. */

const ext: typeof chrome | undefined = (globalThis as any).browser ?? (globalThis as any).chrome

let fallback: Record<string, { message: string; placeholders?: Record<string, { content: string }> }> | null = null

/** Used by unit tests (no extension runtime) to load the English catalog. */
export function setFallbackCatalog(cat: typeof fallback) {
  fallback = cat
}

export function t(key: string, ...subs: (string | number)[]): string {
  const s = subs.map(String)
  const viaApi = ext?.i18n?.getMessage?.(key, s)
  if (viaApi) return viaApi
  const entry = fallback?.[key]
  if (!entry) return key
  let msg = entry.message
  for (const [name, ph] of Object.entries(entry.placeholders ?? {})) {
    const idx = Number(ph.content.replace('$', '')) - 1
    msg = msg.split(`$${name}$`).join(s[idx] ?? '')
  }
  return msg
}

/** Localized Steam tier name (1-9). */
export const tierName = (score: number) => t(`tier${score}`)
export const tierRule = (score: number) => t(`rule${score}`)
