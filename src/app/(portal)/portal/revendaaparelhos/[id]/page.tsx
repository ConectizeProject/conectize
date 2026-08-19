import { redirect, notFound } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { attachResaleDeviceDisplayImage } from '@/lib/seminovos/resale-device-display-image'
import { isRevendaReservedSegment, revendaPath } from '@/lib/revenda/revenda-paths'
import { SeminovosFormClient } from '../../seminovos/SeminovosFormClient'
import { RevendaCreateForm } from '../RevendaCreateForm'

type Props = {
  params: Promise<{ id: string }>
}

export default async function RevendaEditDevicePage ({ params }: Props) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (
    normalizedRole !== 'staff' &&
    normalizedRole !== 'admin' &&
    normalizedRole !== 'platform_admin'
  ) redirect('/portal')

  const { id } = await params
  if (!id) redirect(revendaPath.listagem)
  if (id === 'nova') return <RevendaCreateForm defaultStockType="seminovo" />
  if (isRevendaReservedSegment(id)) redirect(revendaPath.listagem)

  const supabase = await createSupabaseServerClient()
  const [{ data: device, error: deviceError }, { data: costs }] = await Promise.all([
    supabase.from('resale_devices').select('*').eq('id', id).maybeSingle(),
    supabase.from('resale_device_costs').select('id, description, value_cents').eq('resale_device_id', id),
  ])

  if (deviceError || !device) notFound()

  const withCosts = { ...device, costs: costs ?? [] }
  const initialDevice = await attachResaleDeviceDisplayImage(supabase, withCosts)
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'platform_admin'
  const initialDeviceForRole = isAdmin
    ? initialDevice
    : { ...initialDevice, purchase_value_cents: null }

  const backHref = revendaPath.listagem

  return (
    <SeminovosFormClient
      deviceId={id}
      isCreate={false}
      initialDevice={initialDeviceForRole}
      initialDisplayImageUrl={initialDevice.display_image_url}
      backHref={backHref}
      role={normalizedRole}
    />
  )
}
