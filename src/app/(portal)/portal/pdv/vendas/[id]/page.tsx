import { redirect } from 'next/navigation'

type Params = Promise<{ id: string }>

/** Legado — detalhe unificado em /portal/vendas/[id]. */
export default async function PdvVendaDetailRedirectPage ({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  redirect(`/portal/vendas/${id}`)
}
