import { FiscalDocumentsList } from '@/app/(portal)/portal/vendas/fiscal-documents/FiscalDocumentsList'

export default function ContadorNfePage () {
  return (
    <FiscalDocumentsList
      model='55'
      readOnly
      detailBasePath='/portal/contador/nfe'
    />
  )
}
