import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Smartphone } from 'lucide-react'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { fetchPaymentMethodsCatalogForPortal } from '@/lib/portal/payment-methods-server'
import { buildInstallmentTableRows } from '@/lib/resale/credit-installment-max-fee'
import { getResaleDeviceDisplayImageUrl } from '@/lib/seminovos/resale-device-display-image'
import { maskedFromCents } from '@/lib/utils/money'
import { getSeminovosColorEmoji } from '@/lib/seminovos/colors'
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

type Props = {
  params: Promise<{ id: string }>
}

export default async function SeminovoVitrinePage ({ params }: Props) {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal')

  const { id } = await params
  if (!id) notFound()

  const supabase = await createSupabaseServerClient()
  const [{ data: device, error: deviceError }, { data: company }, paymentMethods] = await Promise.all([
    supabase
      .from('resale_devices')
      .select(
        'id, device_name, model, color, storage_gb, battery, condition, info, sale_value_cents, stock_type, sold, image_url, image_storage_path',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('company_settings').select('name').eq('id', 1).maybeSingle(),
    fetchPaymentMethodsCatalogForPortal(supabase),
  ])

  if (deviceError || !device) notFound()

  const saleCents = device.sale_value_cents ?? null
  const installmentRows =
    saleCents != null && saleCents > 0
      ? buildInstallmentTableRows(saleCents, paymentMethods, 12)
      : []

  const stockLabel = device.stock_type === 'lacrado' ? 'Lacrado' : 'Seminovo'
  const title = (device.device_name || device.model || 'Aparelho').trim() || 'Aparelho'
  const displayImageUrl = await getResaleDeviceDisplayImageUrl(
    supabase,
    (device as { image_storage_path?: string | null }).image_storage_path,
    device.image_url,
  )
  const imageOk = Boolean(displayImageUrl)
  const varejoListaHref =
    device.stock_type === 'lacrado'
      ? '/portal/seminovos/varejo?tipo=lacrados'
      : '/portal/seminovos/varejo'

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-3 py-6 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Visão cliente final
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{company?.name ?? 'Loja'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link href={varejoListaHref}>← Lista varejo</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/seminovos/${id}`}>Editar cadastro</Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-0 md:grid-cols-[minmax(200px,320px)_1fr]">
            <div className="relative aspect-square w-full bg-muted md:min-h-[320px] md:aspect-auto">
              {imageOk ? (
                <img
                  src={displayImageUrl!}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
                  <Smartphone className="h-16 w-16 opacity-40" aria-hidden />
                  <p className="text-center text-sm">Sem foto cadastrada</p>
                  <p className="text-center text-xs">
                    Envie uma foto ou informe uma URL no cadastro do aparelho.
                  </p>
                </div>
              )}
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
                {device.battery ? (
                  <div>
                    <dt className="text-muted-foreground">Bateria</dt>
                    <dd className="font-medium">{device.battery}</dd>
                  </div>
                ) : null}
                {device.condition ? (
                  <div>
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd className="font-medium">{device.condition}</dd>
                  </div>
                ) : null}
              </dl>
              {device.info ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Detalhes</p>
                  <p className="whitespace-pre-wrap text-foreground/90">{device.info}</p>
                </div>
              ) : null}
              <div className="border-t pt-4">
                {device.sold ? (
                  <p className="text-sm font-medium text-muted-foreground">Este aparelho já foi vendido.</p>
                ) : saleCents != null && saleCents > 0 ? (
                  <p className="text-lg font-semibold">
                    <span className="text-muted-foreground font-normal text-sm block sm:inline sm:mr-2">
                      Valor à vista (referência)
                    </span>
                    R$ {maskedFromCents(saleCents)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Valor de varejo não cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!device.sold && saleCents != null && saleCents > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cartão de crédito</CardTitle>
            <CardDescription>
              Simulação de 1× a 12× usando a <strong className="text-foreground">maior taxa</strong>{' '}
              cadastrada entre as formas de pagamento tipo crédito. O valor à vista acima é o que a loja
              pretende receber; no cartão, o cliente paga o total com taxa embutida.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Taxa (maior)</TableHead>
                  <TableHead>Total no cartão</TableHead>
                  <TableHead className="text-right">Valor da parcela</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installmentRows.map((row) => (
                  <TableRow key={row.installments}>
                    <TableCell className="font-medium">
                      {row.installments}×
                    </TableCell>
                    <TableCell>
                      {row.feePercent > 0 ? `${row.feePercent}%` : '—'}
                    </TableCell>
                    <TableCell>R$ {maskedFromCents(row.totalChargeCents)}</TableCell>
                    <TableCell className="text-right">
                      R$ {maskedFromCents(row.installmentValueCents)}
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
