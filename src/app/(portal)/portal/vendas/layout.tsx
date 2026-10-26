import { Suspense } from 'react'
import { VendasListKeepAlive } from '@/app/(portal)/portal/vendas/VendasListKeepAlive'
import { VendasModuleTabs } from '@/app/(portal)/portal/vendas/VendasModuleTabs'

export default function VendasLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className='space-y-4 py-4'>
      <Suspense fallback={<p className='text-sm text-muted-foreground'>Carregando…</p>}>
        <VendasModuleTabs />
      </Suspense>
      <div>
        <Suspense fallback={<p className='p-4 text-sm text-muted-foreground'>Carregando…</p>}>
          <VendasListKeepAlive />
        </Suspense>
        {children}
      </div>
    </div>
  )
}
