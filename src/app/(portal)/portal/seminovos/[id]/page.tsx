import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { SeminovosFormClient } from '../SeminovosFormClient'

type Props = {
  params: Promise<{ id: string }>
}

export default async function SeminovosEditPage({ params }: Props) {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal')

  const { id } = await params
  if (!id) redirect('/portal/seminovos')

  const supabase = await createSupabaseServerClient()
  const [{ data: device, error: deviceError }, { data: costs }] = await Promise.all([
    supabase.from('resale_devices').select('*').eq('id', id).maybeSingle(),
    supabase.from('resale_device_costs').select('id, description, value_cents').eq('resale_device_id', id),
  ])

  if (deviceError || !device) notFound()

  const initialDevice = { ...device, costs: costs ?? [] }

  return <SeminovosFormClient deviceId={id} isCreate={false} initialDevice={initialDevice} />
}
