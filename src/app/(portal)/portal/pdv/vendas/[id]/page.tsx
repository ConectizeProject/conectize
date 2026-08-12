import { redirect } from 'next/navigation'

type Params = Promise<{ id: string }>

/** Legado pos_sales removido — redireciona para a listagem de pedidos. */
export default async function PdvVendaDetailRedirectPage ({
  params,
}: {
  params: Params
}) {
  await params
  redirect('/portal/pedidos-venda')
}
