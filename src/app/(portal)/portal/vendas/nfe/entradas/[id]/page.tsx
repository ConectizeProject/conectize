import { InboundNfeDetail } from '@/app/(portal)/portal/vendas/nfe/entradas/InboundNfeDetail'

type Props = {
  params: Promise<{ id: string }>
}

export default async function VendasNfeEntradaDetailPage ({ params }: Props) {
  const { id } = await params
  return <InboundNfeDetail documentId={String(id || '')} />
}
