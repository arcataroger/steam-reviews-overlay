/** Detect the user's Steam language (for the language-specific score) and a flag for it. */

const BCP47_TO_STEAM: [RegExp, string][] = [
  [/^zh-(cn|hans)/i, 'schinese'], [/^zh/i, 'tchinese'], [/^ja/i, 'japanese'], [/^ko/i, 'koreana'],
  [/^ru/i, 'russian'], [/^de/i, 'german'], [/^fr/i, 'french'], [/^es-(419|mx|ar|cl|co|pe|ve)/i, 'latam'],
  [/^es/i, 'spanish'], [/^pt-br/i, 'brazilian'], [/^pt/i, 'portuguese'], [/^it/i, 'italian'],
  [/^pl/i, 'polish'], [/^tr/i, 'turkish'], [/^th/i, 'thai'], [/^vi/i, 'vietnamese'], [/^uk/i, 'ukrainian'],
  [/^nl/i, 'dutch'], [/^sv/i, 'swedish'], [/^da/i, 'danish'], [/^(no|nb|nn)/i, 'norwegian'], [/^fi/i, 'finnish'],
  [/^cs/i, 'czech'], [/^hu/i, 'hungarian'], [/^ro/i, 'romanian'], [/^bg/i, 'bulgarian'], [/^el/i, 'greek'],
  [/^id/i, 'indonesian'], [/^ar/i, 'arabic'], [/^en/i, 'english'],
]

/** Default country for a Steam language when the browser locale has no region. */
const STEAM_TO_COUNTRY: Record<string, string> = {
  english: 'US', schinese: 'CN', tchinese: 'TW', japanese: 'JP', koreana: 'KR', russian: 'RU', german: 'DE',
  french: 'FR', spanish: 'ES', latam: 'MX', brazilian: 'BR', portuguese: 'PT', italian: 'IT', polish: 'PL',
  turkish: 'TR', thai: 'TH', vietnamese: 'VN', ukrainian: 'UA', dutch: 'NL', swedish: 'SE', danish: 'DK',
  norwegian: 'NO', finnish: 'FI', czech: 'CZ', hungarian: 'HU', romanian: 'RO', bulgarian: 'BG', greek: 'GR',
  indonesian: 'ID', arabic: 'SA',
}

/** Language names in their own language, so no translation is needed. */
export const STEAM_LANG_NAMES: Record<string, string> = {
  english: 'English', schinese: '简体中文', tchinese: '繁體中文', japanese: '日本語', koreana: '한국어',
  russian: 'Русский', german: 'Deutsch', french: 'Français', spanish: 'Español', latam: 'Español (Latinoamérica)',
  brazilian: 'Português (Brasil)', portuguese: 'Português', italian: 'Italiano', polish: 'Polski', turkish: 'Türkçe',
  thai: 'ไทย', vietnamese: 'Tiếng Việt', ukrainian: 'Українська', dutch: 'Nederlands', swedish: 'Svenska',
  danish: 'Dansk', norwegian: 'Norsk', finnish: 'Suomi', czech: 'Čeština', hungarian: 'Magyar', romanian: 'Română',
  bulgarian: 'Български', greek: 'Ελληνικά', indonesian: 'Bahasa Indonesia', arabic: 'العربية',
}

export interface LangInfo {
  /** Steam language id, e.g. "english", "schinese" */
  steam: string
  name: string
  /** Emoji flag */
  flag: string
}

/** Region subtag of a BCP 47 tag ("zh-Hans-CN" → "CN"), or undefined. */
export function regionOf(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag.replace('_', '-')).maximize().region ?? undefined
  } catch {
    return tag.split(/[-_]/).find((p, i) => i > 0 && /^[A-Za-z]{2}$/.test(p))
  }
}

export function flagFor(country: string): string {
  const cc = country.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️'
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** Content-script side: Steam_Language cookie wins; browser locale is the fallback. */
export function detectLang(): LangInfo {
  const cookie = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)Steam_Language=(\w+)/) : null
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  let steam = cookie?.[1]
  if (!steam || !STEAM_TO_COUNTRY[steam]) {
    steam = BCP47_TO_STEAM.find(([re]) => re.test(locale))?.[1] ?? 'english'
  }
  // Prefer the browser's region for the flag when it plausibly belongs to this language
  const region = regionOf(locale)
  const localeLang = BCP47_TO_STEAM.find(([re]) => re.test(locale))?.[1]
  const country = region && localeLang === steam ? region : STEAM_TO_COUNTRY[steam]
  return { steam, name: STEAM_LANG_NAMES[steam] ?? steam, flag: flagFor(country) }
}

/** For QA/previews: the Steam language + flag a given extension locale code corresponds to. */
export function langForLocale(locale: string): LangInfo {
  const bcp = locale.replace('_', '-')
  const steam = BCP47_TO_STEAM.find(([re]) => re.test(bcp))?.[1] ?? 'english'
  const region = locale.includes('_') || locale.includes('-') ? regionOf(locale) : undefined
  const country = region ?? STEAM_TO_COUNTRY[steam]
  return { steam, name: STEAM_LANG_NAMES[steam] ?? steam, flag: flagFor(country) }
}

export const LANG_KEY = 'sro:lang:v1'
