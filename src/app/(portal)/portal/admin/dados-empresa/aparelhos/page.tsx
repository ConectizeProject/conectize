import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import {
  AparelhosClient,
  type DeviceModelRow,
} from '@/app/(portal)/portal/aparelhos/AparelhosClient'

type DeviceBrandJoin = { name?: string | null }
type DeviceTypeJoin = {
  name?: string | null
  device_brands?: DeviceBrandJoin | DeviceBrandJoin[] | null
}
type DeviceModelQueryRow = {
  id: string
  model: string | null
  created_at: string | null
  device_types?: DeviceTypeJoin | DeviceTypeJoin[] | null
}

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ brand?: string; deviceType?: string; q?: string }>

export default async function DadosEmpresaAparelhosPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin') redirect('/portal/ordens')

  const { brand, deviceType, q } = await searchParams
  const initialBrand = String(brand ?? '').trim()
  const initialDeviceType = String(deviceType ?? '').trim()
  const initialModelQuery = String(q ?? '').trim()

  const { data: deviceModelsRaw } = await supabase
    .from('device_models')
    .select('id, model, created_at, device_types ( name, device_brands ( name ) )')
    .order('model', { ascending: true })
    .limit(2000)

  const deviceModels: DeviceModelRow[] = (deviceModelsRaw || []).map(
    (d: DeviceModelQueryRow) => {
      const rawDt = d.device_types
      const dt = Array.isArray(rawDt) ? rawDt[0] : rawDt
      const rawBr = dt?.device_brands
      const brandRow = Array.isArray(rawBr) ? rawBr[0] : rawBr
      return {
        id: d.id,
        brand: brandRow?.name ?? null,
        device_type: dt?.name ?? null,
        model: d.model ?? '',
        created_at: d.created_at ?? null,
      }
    },
  )

  return (
    <AparelhosClient
      initialDeviceModels={deviceModels}
      initialBrand={initialBrand}
      initialDeviceType={initialDeviceType}
      initialModelQuery={initialModelQuery}
    />
  )
}

