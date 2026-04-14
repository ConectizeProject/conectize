import { Suspense } from 'react'
import { requireAdminPage } from '@/lib/auth/portal-api'
import type { OrderFinanceInput } from '@/lib/portal/retailer-finance-helpers'
import { fetchShopCustomersForAdmin } from './fetch-shops-for-admin'
import { FinanceiroLojasAdminClient } from './FinanceiroLojasAdminClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ loja?: string }>

export default async function AdminFinanceiroLojasPage ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await requireAdminPage()
  const sp = await searchParams
  const loja = typeof sp.loja === 'string' ? sp.loja.trim() : ''
  const selectedShopId = loja || null

  const [shops, pmRes] = await Promise.all([
    fetchShopCustomersForAdmin(supabase),
    supabase
      .from('payment_methods')
      .select('id, description, type')
      .order('sort_order', { ascending: true }),
  ])

  let ordersRaw: OrderFinanceInput[] = []
  if (selectedShopId) {
    const { data } = await supabase
      .from('service_orders')
      .select(
        'id, display_number, status, services_total_cents, services_cost_total_cents, payment_methods, updated_at, closed_at',
      )
      .eq('customer_id', selectedShopId)
      .order('closed_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
    ordersRaw = (data ?? []) as OrderFinanceInput[]
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro por loja</h1>
        <p className="text-sm text-muted-foreground">
          Mesma visão do lojista por loja e alteração em massa da forma de pagamento nas OS
          selecionadas (valor pago = valor total da OS).
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando…</div>}>
        <FinanceiroLojasAdminClient
          shops={shops}
          paymentMethods={pmRes.data ?? []}
          selectedShopId={selectedShopId}
          ordersRaw={ordersRaw}
        />
      </Suspense>
    </div>
  )
}
