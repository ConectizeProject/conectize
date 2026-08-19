import { DefaultXmlBuilder, type NFeProps, type XmlBuilder } from '@brasil-fiscal/nfe'
import { injectProdNfci } from '@/lib/fiscal/fci'

export function createNfceXmlBuilder (): XmlBuilder {
  const inner = new DefaultXmlBuilder()
  return {
    build (nfe: NFeProps) {
      return injectProdNfci(
        inner.build(nfe),
        nfe.produtos as Array<{ nFCI?: string | null }>,
      )
    },
  }
}
