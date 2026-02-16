import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { AparelhosClient } from './AparelhosClient'

export const dynamic = 'force-dynamic'

export default async function AparelhosPage() {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()
  const { data: deviceModels } = await supabase
    .from('device_models')
    .select('id, brand, device_type, model, created_at')
    .order('brand', { ascending: true })
    .order('device_type', { ascending: true })
    .order('model', { ascending: true })
    .limit(2000)

  return <AparelhosClient initialDeviceModels={(deviceModels || []) as any} />
}

