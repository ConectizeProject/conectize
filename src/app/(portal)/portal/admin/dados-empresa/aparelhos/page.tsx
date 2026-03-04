import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { AparelhosClient } from '@/app/(portal)/portal/aparelhos/AparelhosClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ brand?: string; deviceType?: string; q?: string }>

export default async function DadosEmpresaAparelhosPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) redirect('/portal/login')

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

  const deviceModels = (deviceModelsRaw || []).map((d: any) => {
    const dt = d.device_types || null
    const brandRow = dt?.device_brands || null
    return {
      id: d.id,
      brand: brandRow?.name ?? null,
      device_type: dt?.name ?? null,
      model: d.model ?? null,
      created_at: d.created_at ?? null,
    }
  })

  return (
    <AparelhosClient
      initialDeviceModels={deviceModels as any}
      initialBrand={initialBrand}
      initialDeviceType={initialDeviceType}
      initialModelQuery={initialModelQuery}
    />
  )
}

