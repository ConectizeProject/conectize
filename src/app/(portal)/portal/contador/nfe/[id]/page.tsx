import { ContadorFiscalDocumentViewer } from '@/app/(portal)/portal/contador/ContadorFiscalDocumentViewer'

export default async function ContadorNfeDetailPage ({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ContadorFiscalDocumentViewer model='55' documentId={id} />
}
