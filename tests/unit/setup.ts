import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setFallbackCatalog } from '../../src/i18n'

// No extension runtime under vitest: stub the bits of `chrome` the modules touch at import time.
const store: Record<string, unknown> = {}
;(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (k: string | string[]) => Object.fromEntries((Array.isArray(k) ? k : [k]).map((x) => [x, store[x]])),
      set: async (o: Record<string, unknown>) => Object.assign(store, o),
    },
    sync: undefined,
    onChanged: { addListener() {} },
  },
  i18n: undefined,
}
setFallbackCatalog(JSON.parse(readFileSync(resolve(process.cwd(), '_locales/en/messages.json'), 'utf8')))
export const storageStore = store
