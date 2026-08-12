'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, Percent, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { toast } from '@/hooks/use-toast'
import type { StaffCommissionItem } from '@/lib/finance/staff-commissions'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'

type Totals = {
  pendingCents: number
  paidCents: number
  totalCents: number
  count: number
}

type ListResponse = {
  ok?: boolean
  from?: string
  to?: string
  items?: StaffCommissionItem[]
  totals?: Totals
  error?: string
}

const PRESETS = [
  { from: 'thisMonth', to: 'Este mês' },
  { from: 'lastMonth', to: 'Mês passado' },
  { from: 'thisYear', to: 'Este ano' },
  { from: 'custom', to: 'Período customizado' },
] as const

function buildRange (preset: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const fmt = (date: Date) => date.toISOString().slice(0, 10)
  if (preset === 'thisMonth') {
    return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m, d)) }
  }
  if (preset === 'lastMonth') {
    return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) }
  }
  if (preset === 'thisYear') {
    return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, m, d)) }
  }
  return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m, d)) }
}

function formatDateBr (ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—'
  const [y, mo, d] = ymd.split('-')
  return `${d}/${mo}/${y}`
}

function sourceLabel (source: StaffCommissionItem['source']): string {
  return source === 'os' ? 'OS' : 'Aparelho'
}

export function FinanceiroComissoesClient () {
  const initial = useMemo(() => buildRange('thisMonth'), [])
  const [preset, setPreset] = useState<string>('thisMonth')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [status, setStatus] = useState<'all' | 'pending' | 'paid'>('all')
  const [source, setSource] = useState<'all' | 'os' | 'resale'>('all')
  const [items, setItems] = useState<StaffCommissionItem[]>([])
  const [totals, setTotals] = useState<Totals>({
    pendingCents: 0,
    paidCents: 0,
    totalCents: 0,
    count: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        from,
        to,
        status,
        source,
      })
      const res = await portalFetch(`/api/portal/admin/finance/commissions?${params}`)
      const data = (await res?.json().catch(() => null)) as ListResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível carregar as comissões.')
      }
      setItems(data.items ?? [])
      setTotals(
        data.totals ?? {
          pendingCents: 0,
          paidCents: 0,
          totalCents: 0,
          count: 0,
        },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [from, to, status, source])

  useEffect(() => {
    void load()
  }, [load])

  function handlePresetChange (next: string) {
    setPreset(next)
    if (next !== 'custom') {
      const range = buildRange(next)
      setFrom(range.from)
      setTo(range.to)
    }
  }

  async function togglePaid (item: StaffCommissionItem, nextPaid: boolean) {
    if (togglingIds.has(item.id) || item.isPaid === nextPaid) return

    const snapshot = item
    const optimisticPaidAt = nextPaid ? new Date().toISOString() : null
    const leavesCurrentFilter =
      (status === 'pending' && nextPaid) || (status === 'paid' && !nextPaid)

    setTogglingIds((prev) => {
      const next = new Set(prev)
      next.add(item.id)
      return next
    })

    setItems((prev) => {
      if (leavesCurrentFilter) return prev.filter((row) => row.id !== item.id)
      return prev.map((row) =>
        row.id === item.id
          ? { ...row, isPaid: nextPaid, paidAt: optimisticPaidAt }
          : row,
      )
    })

    setTotals((prev) => {
      const delta = item.amountCents
      if (leavesCurrentFilter) {
        return {
          ...prev,
          count: Math.max(0, prev.count - 1),
          pendingCents: nextPaid
            ? Math.max(0, prev.pendingCents - delta)
            : prev.pendingCents,
          paidCents: nextPaid
            ? prev.paidCents
            : Math.max(0, prev.paidCents - delta),
          totalCents: Math.max(0, prev.totalCents - delta),
        }
      }
      if (nextPaid) {
        return {
          ...prev,
          pendingCents: Math.max(0, prev.pendingCents - delta),
          paidCents: prev.paidCents + delta,
        }
      }
      return {
        ...prev,
        pendingCents: prev.pendingCents + delta,
        paidCents: Math.max(0, prev.paidCents - delta),
      }
    })

    try {
      const res = await portalFetch('/api/portal/admin/finance/commissions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: item.source,
          sourceId: item.sourceId,
          paid: nextPaid,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível atualizar.')
      }

      if (!leavesCurrentFilter && typeof data.paidAt === 'string') {
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? { ...row, isPaid: nextPaid, paidAt: data.paidAt }
              : row,
          ),
        )
      }
    } catch (err) {
      setItems((prev) => {
        if (leavesCurrentFilter) {
          if (prev.some((row) => row.id === snapshot.id)) return prev
          return [...prev, snapshot].sort((a, b) => {
            if (a.earnedAt !== b.earnedAt) return b.earnedAt.localeCompare(a.earnedAt)
            return b.amountCents - a.amountCents
          })
        }
        return prev.map((row) => (row.id === snapshot.id ? snapshot : row))
      })

      setTotals((prev) => {
        const delta = snapshot.amountCents
        if (leavesCurrentFilter) {
          return {
            ...prev,
            count: prev.count + 1,
            pendingCents: snapshot.isPaid
              ? prev.pendingCents
              : prev.pendingCents + delta,
            paidCents: snapshot.isPaid
              ? prev.paidCents + delta
              : prev.paidCents,
            totalCents: prev.totalCents + delta,
          }
        }
        if (nextPaid) {
          return {
            ...prev,
            pendingCents: prev.pendingCents + delta,
            paidCents: Math.max(0, prev.paidCents - delta),
          }
        }
        return {
          ...prev,
          pendingCents: Math.max(0, prev.pendingCents - delta),
          paidCents: prev.paidCents + delta,
        }
      })

      const message = err instanceof Error ? err.message : 'Erro ao atualizar.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="h-5 w-5" aria-hidden />
            Comissões
          </CardTitle>
          <CardDescription>
            Comissões de OS finalizadas e aparelhos vendidos. Marque como paga quando o
            colaborador receber.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="space-y-1.5">
              <Label>Período</Label>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.from} value={p.from}>
                      {p.to}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === 'custom' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="comm-from">De</Label>
                  <Input
                    id="comm-from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comm-to">Até</Label>
                  <Input
                    id="comm-to"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v: 'all' | 'pending' | 'paid') => setStatus(v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select
                value={source}
                onValueChange={(v: 'all' | 'os' | 'resale') => setSource(v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="os">Ordens de serviço</SelectItem>
                  <SelectItem value="resale">Aparelhos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="font-mono text-base font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                R$ {maskedFromCents(totals.pendingCents)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Pagas</p>
              <p className="font-mono text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                R$ {maskedFromCents(totals.paidCents)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Total no período</p>
              <p className="font-mono text-base font-semibold tabular-nums">
                R$ {maskedFromCents(totals.totalCents)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando comissões…
            </div>
          ) : items.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              Nenhuma comissão encontrada neste período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead className="w-[90px]">Origem</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[90px] text-center">Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const busy = togglingIds.has(item.id)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateBr(item.earnedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sourceLabel(item.source)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <Link
                            href={item.href}
                            className="line-clamp-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            {item.label}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{item.userDisplayName}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          R$ {maskedFromCents(item.amountCents)}
                        </TableCell>
                        <TableCell>
                          {item.isPaid ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">Paga</Badge>
                          ) : (
                            <Badge variant="secondary">Pendente</Badge>
                          )}
                          {item.isPaid && item.paidAt ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {format(new Date(item.paidAt), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Checkbox
                                checked={item.isPaid}
                                onCheckedChange={(v) => {
                                  void togglePaid(item, v === true)
                                }}
                                aria-label={
                                  item.isPaid
                                    ? 'Desmarcar comissão como paga'
                                    : 'Marcar comissão como paga'
                                }
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
