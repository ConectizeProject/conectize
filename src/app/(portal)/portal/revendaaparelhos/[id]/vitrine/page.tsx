import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Smartphone } from 'lucide-react'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { fetchPaymentMethodsCatalogForPortal } from '@/lib/portal/payment-methods-server'
import {
  buildInstallmentTableRows,
  getInstallmentRowForCount,
} from '@/lib/resale/credit-installment-max-fee'
import { getResaleDeviceCoverSignedUrls } from '@/lib/seminovos/resale-device-display-image'
import { VitrineCoverPhoto } from './VitrineCoverPhoto'
import { ceilCentsToWholeReais, maskedWholeReaisFromCents } from '@/lib/utils/money'
import { getSeminovosColorEmoji } from '@/lib/seminovos/colors'
import { revendaPath } from '@/lib/revenda/revenda-paths'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ResaleDevicePriceDisplay } from '@/components/resale/ResaleDevicePriceDisplay'
import { ResaleDeviceInfoButton } from '@/components/resale/ResaleDeviceInfoButton'
import { VitrinePagamentoSimulator } from './VitrinePagamentoSimulator'

type Props = {
  params: Promise<{ id: string }>
}

export default async function RevendaVitrinePage ({ params }: Props) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  const canAccessVitrine =
    normalizedRole === 'staff' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'retailer'
  if (!canAccessVitrine) redirect('/portal')

  const isRetailer = normalizedRole === 'retailer'

  const { id } = await params
  if (!id) notFound()

  const supabase = await createSupabaseServerClient()
  const [{ data: device, error: deviceError }, paymentMethods] = await Promise.all([
    supabase
      .from('resale_devices')
      .select(
        'id, device_name, model, color, storage_gb, battery, condition, info, sale_value_cents, wholesale_value_cents, stock_type, sold, image_url, image_storage_path, image_gallery_paths',
      )
      .eq('id', id)
      .maybeSingle(),
    fetchPaymentMethodsCatalogForPortal(supabase),
  ])

  if (deviceError || !device) notFound()

  const saleCents = device.sale_value_cents ?? null
  const wholesaleCents = device.wholesale_value_cents ?? null

  const row12 =
    !device.sold && saleCents != null && saleCents > 0
      ? getInstallmentRowForCount(saleCents, paymentMethods, 12)
      : null

  const installmentTableRows =
    !device.sold && saleCents != null && saleCents > 0
      ? buildInstallmentTableRows(saleCents, paymentMethods, 12)
      : []

  const stockLabel = device.stock_type === 'lacrado' ? 'Novo' : 'Seminovo'
  const title = (device.device_name || device.model || 'Aparelho').trim() || 'Aparelho'
  const infoText = typeof device.info === 'string' ? device.info.trim() : ''
  const coverSigned = await getResaleDeviceCoverSignedUrls(supabase, device as {
    image_storage_path?: string | null
    image_url?: string | null
    image_gallery_paths?: string[] | null
  })
  const displayImageUrl = coverSigned.thumbUrl ?? coverSigned.url
  const displayImageFullUrl = coverSigned.url ?? coverSigned.thumbUrl
  const imageOk = Boolean(displayImageUrl) && !device.sold

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-3 py-6 sm:px-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
          <Link href={revendaPath.listagem}>← Listagem</Link>
        </Button>
        {!device.sold ? (
          <VitrinePagamentoSimulator
            paymentMethods={paymentMethods}
            saleValueCents={saleCents}
            wholesaleValueCents={wholesaleCents}
          />
        ) : null}
        {!isRetailer ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={revendaPath.device(id)}>Editar cadastro</Link>
          </Button>
        ) : null}
      </div>

      <Card className="group overflow-hidden transition-shadow duration-200 hover:shadow-md hover:border-primary/30">
        <CardContent className="p-0">
          <div className="grid gap-0 md:grid-cols-[minmax(200px,320px)_1fr]">
            <div className="relative aspect-square w-full overflow-hidden bg-muted md:min-h-[320px] md:aspect-auto">
              {imageOk ? (
                <VitrineCoverPhoto
                  thumbUrl={displayImageUrl}
                  fullUrl={displayImageFullUrl}
                />
              ) : (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
                  <Smartphone className="h-16 w-16 opacity-40" aria-hidden />
                  <p className="text-center text-sm">Sem foto cadastrada</p>
                </div>
              )}
              {infoText ? (
                <ResaleDeviceInfoButton
                  info={infoText}
                  className="absolute left-2 top-2 z-[5]"
                />
              ) : null}
            </div>
            <div className="space-y-4 p-5 sm:p-6 md:p-8">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stockLabel}</p>
                <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {device.storage_gb ? (
                  <div>
                    <dt className="text-muted-foreground">Armazenamento</dt>
                    <dd className="font-medium">
                      {/gb/i.test(device.storage_gb) ? device.storage_gb : `${device.storage_gb} GB`}
                    </dd>
                  </div>
                ) : null}
                {device.color ? (
                  <div>
                    <dt className="text-muted-foreground">Cor</dt>
                    <dd className="font-medium">
                      <span aria-hidden>{getSeminovosColorEmoji(device.color)}</span>{' '}
                      {device.color}
                    </dd>
                  </div>
                ) : null}
                {device.stock_type !== 'lacrado' && device.battery ? (
                  <div>
                    <dt className="text-muted-foreground">Bateria</dt>
                    <dd className="font-medium">{device.battery}</dd>
                  </div>
                ) : null}
                {device.stock_type !== 'lacrado' && device.condition ? (
                  <div>
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd className="font-medium">{device.condition}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="border-t border-border/80 pt-4">
                {device.sold ? (
                  <p className="text-sm font-medium text-muted-foreground">Este aparelho já foi vendido.</p>
                ) : (
                  <ResaleDevicePriceDisplay
                    saleCents={saleCents}
                    row12={row12}
                    emptyHint="Valor de varejo não cadastrado."
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!device.sold && installmentTableRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cartão de crédito</CardTitle>
            <CardDescription>
              Simulação de 1× a 12× com base nas formas de pagamento em cartão cadastradas. O valor à
              vista acima é a referência da loja; no cartão, os valores consideram os encargos de cada
              opção de parcelamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Total no cartão</TableHead>
                  <TableHead className="text-right">Valor da parcela</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installmentTableRows.map((row) => (
                  <TableRow key={row.installments}>
                    <TableCell className="font-medium">{row.installments}×</TableCell>
                    <TableCell>{row.feePercent > 0 ? `${row.feePercent}%` : '—'}</TableCell>
                    <TableCell>
                      R$ {maskedWholeReaisFromCents(ceilCentsToWholeReais(row.totalChargeCents))}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {maskedWholeReaisFromCents(ceilCentsToWholeReais(row.installmentValueCents))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
