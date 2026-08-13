import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { fetchPaymentMethodsCatalogForPortal } from '@/lib/portal/payment-methods-server'
import {
  fetchResaleDistinctDeviceNames,
  fetchSeminovosDevices,
} from '@/lib/seminovos/fetch-seminovos-data'
import { groupDevicesByModel } from '@/lib/seminovos/group-devices-by-model'
import { attachResaleDeviceDisplayImage } from '@/lib/seminovos/resale-device-display-image'
import {
  createSupabaseServerClient,
  getPortalAuth,
} from '@/lib/supabase/server'
import { moneyToCentsFromMasked } from '@/lib/utils/money'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { RevendaListagemClient } from './RevendaListagemClient'

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
  valueMin?: string
  valueMax?: string
  sold?: string
}>

function looksLikeImeiSearch (q: string): boolean {
  const digits = q.replace(/\D/g, '')
  return digits.length >= 8
}

export default function RevendaAparelhosPage ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
      }
    >
      <RevendaListagemInner searchParams={searchParams} />
    </Suspense>
  )
}

async function RevendaListagemInner ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  const canAccess =
    normalizedRole === 'staff' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'retailer'
  if (!canAccess) redirect('/portal')

  const isRetailer = normalizedRole === 'retailer'
  const isAdmin =
    normalizedRole === 'admin' || normalizedRole === 'platform_admin'

  const params = await searchParams
  const rawValueMin = String(params?.valueMin ?? '').trim()
  const rawValueMax = String(params?.valueMax ?? '').trim()
  const valueMinParsed = moneyToCentsFromMasked(rawValueMin)
  const valueMaxParsed = moneyToCentsFromMasked(rawValueMax)
  const valueMinCents =
    valueMinParsed != null && valueMinParsed > 0 ? valueMinParsed : null
  const valueMaxCents =
    valueMaxParsed != null && valueMaxParsed > 0 ? valueMaxParsed : null

  const q = String(params?.q || '').trim()
  const canManageSale = !isRetailer
  const includeSoldByFilter = canManageSale && params?.sold === '1'
  const includeSold = includeSoldByFilter || looksLikeImeiSearch(q)

  const filters = {
    q,
    condition: String(params?.condition || '').trim(),
    storageGb: String(params?.storageGb || '').trim(),
    color: String(params?.color || '').trim(),
    purchaseDateFrom: isValidDate(params?.purchaseDateFrom || '')
      ? (params?.purchaseDateFrom || '')
      : '',
    purchaseDateTo: isValidDate(params?.purchaseDateTo || '')
      ? (params?.purchaseDateTo || '')
      : '',
    stockType: 'all' as const,
    deviceName: String(params?.deviceName || '').trim(),
    valueMinCents,
    valueMaxCents,
    includeSold,
  }

  const filterInitialValues = {
    q: filters.q,
    condition: filters.condition,
    storageGb: filters.storageGb,
    color: filters.color,
    purchaseDateFrom: filters.purchaseDateFrom,
    purchaseDateTo: filters.purchaseDateTo,
    stockType: 'all' as const,
    deviceName: filters.deviceName,
    valueMin: rawValueMin,
    valueMax: rawValueMax,
    includeSold: includeSoldByFilter,
  }

  const supabase = await createSupabaseServerClient()
  const [devicesRaw, paymentMethods, distinctDeviceNames] = await Promise.all([
    fetchSeminovosDevices(supabase, filters),
    fetchPaymentMethodsCatalogForPortal(supabase),
    fetchResaleDistinctDeviceNames(supabase, 'all'),
  ])

  const devices = isAdmin
    ? devicesRaw
    : devicesRaw.map((d) => ({
        ...d,
        purchase_value_cents: null,
        costs: [],
      }))

  const orderedDevices = groupDevicesByModel(devices).flatMap((g) => g.devices)
  const devicesWithDisplay = await Promise.all(
    orderedDevices.map((d) => attachResaleDeviceDisplayImage(supabase, d)),
  )

  return (
    <RevendaListagemClient
      devices={devicesWithDisplay}
      paymentMethods={paymentMethods}
      isRetailer={isRetailer}
      isAdmin={isAdmin}
      canManageSale={canManageSale}
      filterInitialValues={filterInitialValues}
      distinctDeviceNames={distinctDeviceNames}
    />
  )
}
