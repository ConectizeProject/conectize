import { Suspense } from 'react'
import { InboundNfeCreateClient } from '@/app/(portal)/portal/vendas/nfe/entradas/nova/InboundNfeCreateClient'

export default function VendasNfeEntradaNovaPage () {
  return (
    <Suspense fallback={<p className='text-sm text-muted-foreground'>Carregando...</p>}>
      <InboundNfeCreateClient />
    </Suspense>
  )
}
