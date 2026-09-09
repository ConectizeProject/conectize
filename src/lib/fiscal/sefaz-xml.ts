import { DefaultXmlBuilder, type NFeProps, type XmlBuilder } from '@brasil-fiscal/nfe'
import { injectProdNfci } from '@/lib/fiscal/fci'
import { injectNfceIbscbs, type NfceIbscbsPayload } from '@/lib/fiscal/ibscbs'

/**
 * O @brasil-fiscal assina o XML como string (sem parser). Já a SEFAZ faz C14N
 * de verdade: em texto, `&apos;` vira `'` e `&quot;` vira `"`. O digest diverge
 * e a SEFAZ devolve rejeição 297. Aspas/apóstrofos literais são válidos no XML
 * (atributos do builder usam aspas duplas).
 */
export function fixXmlEntitiesForStringCanonicalization (xml: string) {
  return xml
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
}

export function createNfceXmlBuilder (): XmlBuilder {
  const inner = new DefaultXmlBuilder()
  return {
    build (nfe: NFeProps) {
      const withFci = injectProdNfci(
        inner.build(nfe),
        nfe.produtos as Array<{ nFCI?: string | null }>,
      )
      const withIbscbs = injectNfceIbscbs(withFci, nfe as NFeProps & NfceIbscbsPayload)
      return fixXmlEntitiesForStringCanonicalization(withIbscbs)
    },
  }
}
