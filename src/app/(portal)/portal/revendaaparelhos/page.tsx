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
}>

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
    normalizedRole === 'retailer'
  if (!canAccess) redirect('/portal')

  const isRetailer = normalizedRole === 'retailer'

  const params = await searchParams
  const rawValueMin = String(params?.valueMin ?? '').trim()
  const rawValueMax = String(params?.valueMax ?? '').trim()
  const valueMinParsed = moneyToCentsFromMasked(rawValueMin)
  const valueMaxParsed = moneyToCentsFromMasked(rawValueMax)
  const valueMinCents =
    valueMinParsed != null && valueMinParsed > 0 ? valueMinParsed : null
  const valueMaxCents =
    valueMaxParsed != null && valueMaxParsed > 0 ? valueMaxParsed : null

  const filters = {
    q: String(params?.q || '').trim(),
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
  }

  const supabase = await createSupabaseServerClient()
  const [devices, paymentMethods, distinctDeviceNames] = await Promise.all([
    fetchSeminovosDevices(supabase, filters),
    fetchPaymentMethodsCatalogForPortal(supabase),
    fetchResaleDistinctDeviceNames(supabase, 'all'),
  ])

  const orderedDevices = groupDevicesByModel(devices).flatMap((g) => g.devices)
  const devicesWithDisplay = await Promise.all(
    orderedDevices.map((d) => attachResaleDeviceDisplayImage(supabase, d)),
  )

  return (
    <RevendaListagemClient
      devices={devicesWithDisplay}
      paymentMethods={paymentMethods}
      isRetailer={isRetailer}
      filterInitialValues={filterInitialValues}
      distinctDeviceNames={distinctDeviceNames}
    />
  )
}
