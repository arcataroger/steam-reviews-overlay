import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setFallbackCatalog, t } from '../../src/i18n'

const dir = resolve(process.cwd(), '_locales')
const locales = readdirSync(dir)
const en = JSON.parse(readFileSync(resolve(dir, 'en/messages.json'), 'utf8'))

describe('locale catalogs', () => {
  it('cover every language Steam supports', () => {
    expect(locales.length).toBe(30)
  })
  for (const loc of locales) {
    it(`${loc}: has every key, keeps placeholders, and renders`, () => {
      ;(globalThis as any).chrome = { i18n: undefined }
      const cat = JSON.parse(readFileSync(resolve(dir, loc, 'messages.json'), 'utf8'))
      for (const k of Object.keys(en)) {
        expect(cat[k]?.message, `${loc} missing ${k}`).toBeTruthy()
        for (const p of Object.keys(en[k].placeholders ?? {})) expect(cat[k].message).toContain(`$${p}$`)
      }
      setFallbackCatalog(cat)
      const tip = t('tooltip', 'X', 'Y', 87, '1,234')
      expect(tip).toContain('87')
      expect(tip).toContain('1,234')
      expect(tip).not.toMatch(/\$[A-Z]+\$/)
      // all nine Steam labels present and distinct
      const tiers = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => t(`tier${n}`))
      expect(new Set(tiers).size).toBe(9)
    })
  }
})
