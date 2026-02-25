import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { AparelhosClient } from './AparelhosClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ brand?: string; deviceType?: string; q?: string }>

export default async function AparelhosPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const { brand, deviceType, q } = await searchParams
  const initialBrand = String(brand ?? '').trim()
  const initialDeviceType = String(deviceType ?? '').trim()
  const initialModelQuery = String(q ?? '').trim()

  const supabase = await createSupabaseServerClient()
  const { data: deviceModels } = await supabase
    .from('device_models')
    .select('id, brand, device_type, model, created_at')
    .order('brand', { ascending: true })
    .order('device_type', { ascending: true })
    .order('model', { ascending: true })
    .limit(2000)

  return (
    <AparelhosClient
      initialDeviceModels={(deviceModels || []) as any}
      initialBrand={initialBrand}
      initialDeviceType={initialDeviceType}
      initialModelQuery={initialModelQuery}
    />
  )
}

