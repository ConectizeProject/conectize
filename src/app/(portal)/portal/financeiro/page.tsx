import { FinanceiroMovimentacaoClient } from './FinanceiroMovimentacaoClient'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default function FinanceiroMovimentacaoPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Carregando…</div>}>
      <FinanceiroMovimentacaoClient />
    </Suspense>
  )
}
