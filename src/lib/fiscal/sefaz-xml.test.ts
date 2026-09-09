import { describe, expect, it } from 'vitest'
import { fixXmlEntitiesForStringCanonicalization } from '@/lib/fiscal/sefaz-xml'

describe('fixXmlEntitiesForStringCanonicalization', () => {
  it('converts text entities that break string-based C14N digests', () => {
    const xml = '<xNome>D&apos;Angelo</xNome><xProd>Cabo 24&quot;</xProd><xFant>A &amp; B</xFant>'
    expect(fixXmlEntitiesForStringCanonicalization(xml)).toBe(
      '<xNome>D\'Angelo</xNome><xProd>Cabo 24"</xProd><xFant>A &amp; B</xFant>',
    )
  })
})
