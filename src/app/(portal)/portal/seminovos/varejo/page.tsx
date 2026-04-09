import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronRight, Smartphone } from 'lucide-react'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { fetchPaymentMethodsCatalogForPortal } from '@/lib/portal/payment-methods-server'
import { getInstallmentRowForCount } from '@/lib/resale/credit-installment-max-fee'
import { fetchSeminovosDevices } from '@/lib/seminovos/fetch-seminovos-data'
import { groupDevicesByModel } from '@/lib/seminovos/group-devices-by-model'
import { attachResaleDeviceDisplayImage } from '@/lib/seminovos/resale-device-display-image'
import { maskedFromCents } from '@/lib/utils/money'
import { getSeminovosColorEmoji } from '@/lib/seminovos/colors'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { SeminovosSubmenu } from '../SeminovosSubmenu'

type SearchParams = Promise<{ tipo?: string }>

function formatStorageLabel (raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  return /gb/i.test(t) ? t : `${t} GB`
}

export default function SeminovosVarejoListPage ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Carregando…</div>}>
      <SeminovosVarejoListInner searchParams={searchParams} />
    </Suspense>
  )
}

async function SeminovosVarejoListInner ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal')

  const params = await searchParams
  const tipoRaw = String(params?.tipo || '').toLowerCase()
  const stockType: 'seminovo' | 'lacrado' = tipoRaw === 'lacrados' ? 'lacrado' : 'seminovo'

  const filters = {
    q: '',
    condition: '',
    storageGb: '',
    color: '',
    purchaseDateFrom: '',
    purchaseDateTo: '',
    stockType,
  }

  const supabase = await createSupabaseServerClient()
  const [devices, paymentMethods] = await Promise.all([
    fetchSeminovosDevices(supabase, filters),
    fetchPaymentMethodsCatalogForPortal(supabase),
  ])

  const orderedDevices = groupDevicesByModel(devices).flatMap((g) => g.devices)
  const devicesWithDisplay = await Promise.all(
    orderedDevices.map((d) => attachResaleDeviceDisplayImage(supabase, d)),
  )

  const operacionalHref =
    stockType === 'lacrado' ? '/portal/seminovos?tipo=lacrados' : '/portal/seminovos'

  const stockLabel = stockType === 'lacrado' ? 'Lacrados' : 'Seminovos'

  return (
    <div className="space-y-4 px-1 pb-8 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Lista para varejo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mesma ordem da listagem de seminovos (modelo e GB). Em cada card: valor à vista e{' '}
            <span className="font-medium text-foreground">parcelamento em 12×</span> no cartão (maior taxa
            cadastrada entre as formas de crédito). Toque para abrir a vitrine completa.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 w-fit" asChild>
          <Link href={operacionalHref}>Voltar à listagem operacional</Link>
        </Button>
      </div>

      <SeminovosSubmenu />

      <p className="text-xs text-muted-foreground">
        Exibindo estoque disponível: <span className="font-medium text-foreground">{stockLabel}</span>
        {' · '}
        {devicesWithDisplay.length} aparelho{devicesWithDisplay.length === 1 ? '' : 's'}
      </p>

      {devicesWithDisplay.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum aparelho disponível nesta categoria.{' '}
          <Link href={operacionalHref} className="text-primary underline">
            Ver listagem operacional
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {devicesWithDisplay.map((d) => {
            const title = (d.device_name || d.model || 'Aparelho').trim() || 'Aparelho'
            const storageLabel = formatStorageLabel(d.storage_gb)
            const displayUrl = d.display_image_url
            const imgOk = Boolean(displayUrl)
            const saleCents = d.sale_value_cents ?? null
            const row12 =
              saleCents != null && saleCents > 0
                ? getInstallmentRowForCount(saleCents, paymentMethods, 12)
                : null

            return (
              <Link
                key={d.id}
                href={`/portal/seminovos/${d.id}/vitrine`}
                className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="h-full overflow-hidden border transition-shadow hover:shadow-md hover:border-primary/30">
                  <div className="relative aspect-[4/3] bg-muted">
                    {imgOk ? (
                      <img
                        src={displayUrl!}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Smartphone className="h-14 w-14 opacity-35" aria-hidden />
                      </div>
                    )}
                  </div>
                  <CardContent className="space-y-3 p-4">
                    <div className="space-y-1">
                      <h2 className="font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">{title}</h2>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {storageLabel ? <span>{storageLabel}</span> : null}
                        {d.color ? (
                          <span>
                            <span aria-hidden>{getSeminovosColorEmoji(d.color)}</span> {d.color}
                          </span>
                        ) : null}
                        {d.battery ? <span>{d.battery}</span> : null}
                        {d.condition ? <span>{d.condition}</span> : null}
                      </div>
                    </div>
                    {d.info ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">{d.info}</p>
                    ) : null}
                    <div className="space-y-2 border-t pt-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          À vista
                        </p>
                        <p className="text-lg font-bold tabular-nums">
                          {saleCents != null && saleCents > 0
                            ? `R$ ${maskedFromCents(saleCents)}`
                            : 'Sob consulta'}
                        </p>
                      </div>
                      <div className="rounded-md bg-primary/5 px-2.5 py-2 border border-primary/10">
                        <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                          Cartão 12× <span className="font-normal">(maior taxa)</span>
                        </p>
                        {row12 ? (
                          <p className="text-base font-semibold tabular-nums text-primary">
                            12× R$ {maskedFromCents(row12.installmentValueCents)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Cadastre valor de varejo</p>
                        )}
                        {row12 && row12.feePercent > 0 ? (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Total no cartão R$ {maskedFromCents(row12.totalChargeCents)} · taxa {row12.feePercent}%
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="flex items-center justify-end gap-0.5 text-xs font-medium text-primary pt-0.5">
                      Ver vitrine
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
