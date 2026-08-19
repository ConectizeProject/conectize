import { DefaultXmlBuilder, type NFeProps, type XmlBuilder } from '@brasil-fiscal/nfe'
import { injectProdNfci } from '@/lib/fiscal/fci'
import { injectNfceIbscbs, type NfceIbscbsPayload } from '@/lib/fiscal/ibscbs'

export function createNfceXmlBuilder (): XmlBuilder {
  const inner = new DefaultXmlBuilder()
  return {
    build (nfe: NFeProps) {
      const withFci = injectProdNfci(
        inner.build(nfe),
        nfe.produtos as Array<{ nFCI?: string | null }>,
      )
      return injectNfceIbscbs(withFci, nfe as NFeProps & NfceIbscbsPayload)
    },
  }
}
