import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AparelhosClient } from './AparelhosClient'

export const dynamic = 'force-dynamic'

export default async function AparelhosPage() {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) redirect('/portal/login')

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const { data: deviceModels } = await supabase
    .from('device_models')
    .select('id, brand, device_type, model, created_at')
    .order('brand', { ascending: true })
    .order('device_type', { ascending: true })
    .order('model', { ascending: true })
    .limit(2000)

  return <AparelhosClient initialDeviceModels={(deviceModels || []) as any} />
}

