import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { fetchSeminovosDevices, fetchSeminovosStats } from '@/lib/seminovos/fetch-seminovos-data'
import { SeminovosListClient } from './SeminovosListClient'

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

type SearchParams = Promise<{
  q?: string
  condition?: string
  storageGb?: string
  color?: string
  purchaseDateFrom?: string
  purchaseDateTo?: string
}>

export default async function SeminovosPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal')

  const params = await searchParams
  const filters = {
    q: String(params?.q || '').trim(),
    condition: String(params?.condition || '').trim(),
    storageGb: String(params?.storageGb || '').trim(),
    color: String(params?.color || '').trim(),
    purchaseDateFrom: isValidDate(params?.purchaseDateFrom || '') ? (params?.purchaseDateFrom || '') : '',
    purchaseDateTo: isValidDate(params?.purchaseDateTo || '') ? (params?.purchaseDateTo || '') : '',
  }

  const supabase = await createSupabaseServerClient()
  const [devices, stats] = await Promise.all([
    fetchSeminovosDevices(supabase, filters),
    fetchSeminovosStats(supabase),
  ])

  return (
    <SeminovosListClient
      initialDevices={devices}
      initialStats={stats}
      filterInitialValues={filters}
      role={normalizedRole}
    />
  )
}
