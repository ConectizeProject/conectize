'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { FiscalDocumentEditor } from '@/app/(portal)/portal/vendas/fiscal-documents/FiscalDocumentEditor'

export default function VendasNfeDocumentPage () {
  const params = useParams()
  const id = String(params?.id || '')
  if (!id) return null
  return (
    <Suspense fallback={<p className='text-sm text-muted-foreground'>Carregando nota...</p>}>
      <FiscalDocumentEditor documentId={id} />
    </Suspense>
  )
}
