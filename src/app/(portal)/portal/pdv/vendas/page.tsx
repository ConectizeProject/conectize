import { redirect } from 'next/navigation'

/** Legado pos_sales removido — histórico unificado em Pedidos de venda. */
export default function PdvVendasRedirectPage () {
  redirect('/portal/pedidos-venda')
}
