import { InboundNfeList } from '@/app/(portal)/portal/vendas/nfe/entradas/InboundNfeList'

export const metadata = {
  title: 'Notas fiscais de entrada · Portal',
}

export default function NotasFiscaisEntradaPage () {
  return (
    <InboundNfeList
      title='Notas fiscais de entrada'
      showOutboundLink={false}
    />
  )
}
