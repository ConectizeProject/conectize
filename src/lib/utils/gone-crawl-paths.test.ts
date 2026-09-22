import { describe, expect, it } from 'vitest'
import { isGoneCrawlPath } from '@/lib/utils/gone-crawl-paths'

describe('isGoneCrawlPath', () => {
  it('marks leftover Mercado Livre paths as gone', () => {
    expect(isGoneCrawlPath('/p/programa-compra-garantida')).toBe(true)
    expect(isGoneCrawlPath('/p/contato')).toBe(true)
    expect(isGoneCrawlPath('/share')).toBe(true)
    expect(isGoneCrawlPath('/navigationaddresses-hub')).toBe(true)
  })

  it('leaves real Mercado Livre item redirects to next.config', () => {
    expect(isGoneCrawlPath('/p/MLB22547805')).toBe(false)
  })

  it('leaves site pages alone', () => {
    expect(isGoneCrawlPath('/servicos')).toBe(false)
    expect(isGoneCrawlPath('/loja')).toBe(false)
  })
})