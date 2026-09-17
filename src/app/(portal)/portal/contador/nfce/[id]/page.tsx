import { ContadorFiscalDocumentViewer } from '@/app/(portal)/portal/contador/ContadorFiscalDocumentViewer'

export default async function ContadorNfceDetailPage ({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ContadorFiscalDocumentViewer model='65' documentId={id} />
}
