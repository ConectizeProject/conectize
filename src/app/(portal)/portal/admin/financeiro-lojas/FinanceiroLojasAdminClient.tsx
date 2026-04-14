'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  enrichOrderFinance,
  filterOrdersForFinanceList,
  sumOpenCents,
  type OrderFinanceInput,
} from '@/lib/portal/retailer-finance-helpers'
import { formatCentsBr } from '@/lib/utils/format-money'
import { getOrderStatusLabel } from '@/lib/orders/order-status'
import { applyBulkPaymentMethodsAction, type ApplyBulkPaymentResult } from './apply-bulk-payment-action'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type ShopOption = { id: string; label: string }

type PaymentMethodOption = { id: string; description: string; type: string }

type Props = {
  shops: ShopOption[]
  paymentMethods: PaymentMethodOption[]
  selectedShopId: string | null
  ordersRaw: OrderFinanceInput[]
}

export function FinanceiroLojasAdminClient (props: Props) {
  const { shops, paymentMethods, selectedShopId, ordersRaw } = props
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const enriched = useMemo(() => {
    const f = filterOrdersForFinanceList(ordersRaw)
    return f.map(enrichOrderFinance)
  }, [ordersRaw])

  const totalAberto = useMemo(() => sumOpenCents(enriched), [enriched])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [selectedShopId])

  const [state, formAction, isPending] = useActionState(
    applyBulkPaymentMethodsAction,
    null as ApplyBulkPaymentResult | null,
  )

  useEffect(() => {
    if (state?.ok) {
      router.refresh()
    }
  }, [state, router])

  function onShopChange (value: string) {
    const n = new URLSearchParams(searchParams.toString())
    if (value) n.set('loja', value)
    else n.delete('loja')
    const q = n.toString()
    router.push(q ? `/portal/admin/financeiro-lojas?${q}` : '/portal/admin/financeiro-lojas')
  }

  function toggleId (id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll (checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(enriched.map((o) => o.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const defaultPm = paymentMethods[0]?.id ?? ''

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 min-w-[240px]">
          <Label htmlFor="shop-select">Loja</Label>
          <Select
            value={selectedShopId ?? ''}
            onValueChange={onShopChange}
          >
            <SelectTrigger id="shop-select" className="w-full sm:w-[320px]">
              <SelectValue placeholder="Selecione uma loja" />
            </SelectTrigger>
            <SelectContent>
              {shops.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state?.ok === false ? (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state?.ok === true ? (
        <Alert>
          <AlertTitle>Atualizado</AlertTitle>
          <AlertDescription>
            {state.updated} OS(s) atualizada(s) com a forma de pagamento.
          </AlertDescription>
        </Alert>
      ) : null}

      {!selectedShopId ? (
        <p className="text-sm text-muted-foreground">Selecione uma loja para ver o financeiro.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total em aberto (loja)</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatCentsBr(totalAberto)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ordens finalizadas</CardTitle>
              <CardDescription>
                Marque as OS e aplique uma forma de pagamento em massa (valor pago = valor da OS).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 overflow-x-auto">
              <form action={formAction} className="flex flex-wrap items-end gap-4 border-b pb-4">
                <input type="hidden" name="customerId" value={selectedShopId} />
                <input
                  type="hidden"
                  name="orderIds"
                  value={[...selectedIds].join(',')}
                />
                <div className="space-y-2">
                  <Label htmlFor="payment-method-bulk">Forma de pagamento</Label>
                  <select
                    id="payment-method-bulk"
                    name="paymentMethodId"
                    className="flex h-10 w-[260px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={defaultPm}
                    required
                  >
                    {paymentMethods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments-bulk">Parcelas (cartão crédito)</Label>
                  <Input
                    id="installments-bulk"
                    name="installments"
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={1}
                    className="w-24"
                  />
                </div>
                <Button type="submit" disabled={isPending || selectedIds.size === 0}>
                  {isPending ? 'Aplicando…' : 'Aplicar às selecionadas'}
                </Button>
              </form>

              {enriched.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ordem finalizada para esta loja.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            enriched.length > 0 && selectedIds.size === enriched.length
                          }
                          onCheckedChange={(v) => toggleAll(Boolean(v))}
                          aria-label="Selecionar todas"
                        />
                      </TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor serviço</TableHead>
                      <TableHead className="text-right">Custo OS</TableHead>
                      <TableHead className="text-right">Valor pago</TableHead>
                      <TableHead className="text-right">Em aberto</TableHead>
                      <TableHead>Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enriched.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(o.id)}
                            onCheckedChange={(v) => toggleId(o.id, Boolean(v))}
                            aria-label={`Selecionar OS ${o.display_number}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/portal/ordens/${o.display_number ?? o.id}`}
                            className="hover:underline"
                          >
                            #{o.display_number ?? o.id}
                          </Link>
                        </TableCell>
                        <TableCell>{getOrderStatusLabel(o.status)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCentsBr(o.services_total_cents ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCentsBr(o.services_cost_total_cents ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCentsBr(o.valorPagoCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCentsBr(o.valorEmAbertoCents)}
                        </TableCell>
                        <TableCell>
                          {o.financeLabel === 'pago' ? (
                            <Badge variant="secondary">Pago</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
