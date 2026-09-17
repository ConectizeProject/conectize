import { FiscalDocumentsList } from '@/app/(portal)/portal/vendas/fiscal-documents/FiscalDocumentsList'

export default function ContadorNfcePage () {
  return (
    <FiscalDocumentsList
      model='65'
      readOnly
      detailBasePath='/portal/contador/nfce'
    />
  )
}
