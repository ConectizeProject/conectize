import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { fetchDeviceModelsForSelector } from '@/lib/portal/device-models-server'
import { fetchPaymentMethodsCatalogForPortal } from '@/lib/portal/payment-methods-server'
import { getOrdemErrorMessage } from '@/lib/utils/error-messages'
import { createOrderAction } from './create-order-action'
import { NovaOrdemClient } from './NovaOrdemClient'

export default async function NovaOrdemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; duplicate?: string }>
}) {
  const { error, duplicate } = await searchParams

  const { user, role, fullName } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  const sellerName = fullName || user.email || ''
  const isAdmin = role === 'admin'

  const [sellerOptionsResult, deviceModels, paymentMethodsCatalog] = await Promise.all([
    isAdmin
      ? supabase.from('users').select('id, email, full_name').in('role', ['admin', 'staff']).order('email')
      : Promise.resolve({ data: [] }),
    fetchDeviceModelsForSelector(supabase),
    fetchPaymentMethodsCatalogForPortal(supabase),
  ])

  type SellerOptionRow = { id: string; full_name: string | null; email: string | null }
  const sellerOptions: SellerOptionRow[] = isAdmin
    ? (sellerOptionsResult.data ?? []).map((u: SellerOptionRow) => ({
        id: u.id,
        full_name: u.full_name ?? null,
        email: u.email ?? null,
      }))
    : []

  return (
    <NovaOrdemClient
      action={createOrderAction}
      sellerName={sellerName}
      isAdmin={isAdmin}
      sellerOptions={sellerOptions}
      deviceModels={deviceModels}
      paymentMethodsCatalog={paymentMethodsCatalog}
      currentUserId={user.id}
      initialError={error ? getOrdemErrorMessage(error) : undefined}
      duplicateOrderId={duplicate || undefined}
    />
  )
}

