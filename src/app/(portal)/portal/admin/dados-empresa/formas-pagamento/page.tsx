import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { FormasPagamentoClient } from './FormasPagamentoClient'

export default async function FormasPagamentoPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) redirect('/portal/login')

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin') redirect('/portal/ordens')

  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('*')
    .order('sort_order', { ascending: true })

  return (
    <FormasPagamentoClient
      initialPaymentMethods={(paymentMethods ?? []).map((pm) => ({
        id: pm.id,
        description: pm.description ?? '',
        type: pm.type ?? 'dinheiro',
        fee_percent: Number(pm.fee_percent ?? 0),
        credit_installment_fees: Array.isArray(pm.credit_installment_fees)
          ? pm.credit_installment_fees
          : [],
        sort_order: pm.sort_order ?? 0,
        conta_id: (pm as { conta_id?: string | null }).conta_id ?? null,
      }))}
    />
  )
}
