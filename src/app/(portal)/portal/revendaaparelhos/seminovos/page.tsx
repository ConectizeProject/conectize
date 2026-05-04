import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import {
  fetchSeminovosDevices,
  fetchSeminovosStats,
  fetchResaleDistinctDeviceNames,
} from '@/lib/seminovos/fetch-seminovos-data'
import { attachResaleDeviceDisplayImage } from '@/lib/seminovos/resale-device-display-image'
import { SeminovosListClient } from '../../seminovos/SeminovosListClient'

function isValidDate (value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

type SearchParams = Promise<{
  q?: string
  condition?: string
  storageGb?: string
  color?: string
  purchaseDateFrom?: string
  purchaseDateTo?: string
  deviceName?: string
}>

export default async function RevendaSeminovosPage ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Carregando…</div>}>
      <RevendaSeminovosInner searchParams={searchParams} />
    </Suspense>
  )
}

async function RevendaSeminovosInner ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (
    normalizedRole !== 'admin' &&
    normalizedRole !== 'platform_admin'
  ) redirect('/portal')

  const params = await searchParams
  const filters = {
    q: String(params?.q || '').trim(),
    condition: String(params?.condition || '').trim(),
    storageGb: String(params?.storageGb || '').trim(),
    color: String(params?.color || '').trim(),
    purchaseDateFrom: isValidDate(params?.purchaseDateFrom || '') ? (params?.purchaseDateFrom || '') : '',
    purchaseDateTo: isValidDate(params?.purchaseDateTo || '') ? (params?.purchaseDateTo || '') : '',
    stockType: 'seminovo' as const,
    deviceName: String(params?.deviceName || '').trim(),
  }

  const supabase = await createSupabaseServerClient()
  const [devicesRaw, stats, distinctDeviceNames] = await Promise.all([
    fetchSeminovosDevices(supabase, filters),
    fetchSeminovosStats(supabase),
    fetchResaleDistinctDeviceNames(supabase, 'seminovo'),
  ])

  const devices = await Promise.all(
    devicesRaw.map((d) => attachResaleDeviceDisplayImage(supabase, d)),
  )
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'platform_admin'
  const devicesForRole = isAdmin
    ? devices
    : devices.map((d) => ({ ...d, purchase_value_cents: null }))

  return (
    <SeminovosListClient
      initialDevices={devicesForRole}
      initialStats={stats}
      filterInitialValues={filters}
      distinctDeviceNames={distinctDeviceNames}
      role={normalizedRole}
    />
  )
}
