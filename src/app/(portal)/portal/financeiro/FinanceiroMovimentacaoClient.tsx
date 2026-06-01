'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Pencil, Loader2, CalendarIcon, Trash2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { maskedFromCents } from '@/lib/utils/money'
import { formatMoneyInput, moneyToCentsFromMasked } from '@/lib/utils/money'
import { portalFetch } from '@/lib/portal/portal-fetch'
import type { RecurringPendingDto } from '@/lib/finance/recurring-due'
import {
  FinanceiroNovoRegistroDialog,
  type ApiFinancialTransactionRow,
} from './FinanceiroNovoRegistroDialog'

type Movement = {
  id: string
  source: 'transaction' | 'os' | 'seminovo' | 'pdv'
  conta_id: string | null
  conta_name: string
  amount_cents: number
  type: string
  description: string
  occurred_at: string
  created_at: string
  transfer_id: string | null
  recurring_expense_id: string | null
  service_order_id: string | null
  /** URL da OS no portal (número de exibição quando existir). */
  service_order_href: string | null
  resale_device_id: string | null
  pos_sale_id: string | null
  editable: boolean
}

function movementFromApiTransaction (tx: ApiFinancialTransactionRow, contaName: string): Movement {
  const oc = String(tx.occurred_at ?? '').slice(0, 10)
  return {
    id: tx.id,
    source: 'transaction',
    conta_id: tx.conta_id,
    conta_name: contaName,
    amount_cents: Number(tx.amount_cents),
    type: String(tx.type ?? ''),
    description: tx.description ?? '',
    occurred_at: oc,
    created_at: String(tx.created_at ?? new Date().toISOString()),
    transfer_id: tx.transfer_id ?? null,
    recurring_expense_id: tx.recurring_expense_id ?? null,
    service_order_id: null,
    service_order_href: null,
    resale_device_id: null,
    pos_sale_id: null,
    editable: true,
  }
}

type Bank = { id: string; name: string }

type ContaBalance = { id: string; name: string; balance_cents: number }
type RecurringExpense = {
  id: string
  description: string
  amount_cents: number
  conta_id: string
  billing_day: number
  is_active: boolean
}

const PRESETS = [
  { from: 'thisMonth', to: 'Este mês' },
  { from: 'lastMonth', to: 'Mês passado' },
  { from: 'thisYear', to: 'Este ano' },
  { from: 'custom', to: 'Período customizado' },
] as const

function buildRange(preset: string): { from: string; to: string } {
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

export function FinanceiroMovimentacaoClient() {
  const [preset, setPreset] = useState<string>('thisMonth')
  const initialRange = buildRange('thisMonth')
  const [customFrom, setCustomFrom] = useState<string>(initialRange.from)
  const [customTo, setCustomTo] = useState<string>(initialRange.to)
  const [movements, setMovements] = useState<Movement[]>([])
  const [contas, setContas] = useState<Bank[]>([])
  const [balances, setBalances] = useState<ContaBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editOccurredAt, setEditOccurredAt] = useState('')
  const [editContaId, setEditContaId] = useState('')
  const [isSyncingServiceOrders, setIsSyncingServiceOrders] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'os' | 'pdv' | 'seminovo'>('all')
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false)
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [loadingRecurring, setLoadingRecurring] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null)
  const [editingRecurringDescription, setEditingRecurringDescription] = useState('')
  const [editingRecurringAmount, setEditingRecurringAmount] = useState('')
  const [editingRecurringContaId, setEditingRecurringContaId] = useState('')
  const [editingRecurringBillingDay, setEditingRecurringBillingDay] = useState('')
  const [editingRecurringActive, setEditingRecurringActive] = useState(true)
  const [newRecurringDescription, setNewRecurringDescription] = useState('')
  const [newRecurringAmount, setNewRecurringAmount] = useState('')
  const [newRecurringContaId, setNewRecurringContaId] = useState('')
  const [newRecurringBillingDay, setNewRecurringBillingDay] = useState('1')
  const [recurringPending, setRecurringPending] = useState<RecurringPendingDto[]>([])
  const [settleTarget, setSettleTarget] = useState<RecurringPendingDto | null>(null)
  const [settlePaidAt, setSettlePaidAt] = useState('')

  const range = preset === 'custom'
    ? {
        from: /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : initialRange.from,
        to: /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : initialRange.to,
      }
    : buildRange(preset)
  const { from, to } = range

  const loadContas = useCallback(async () => {
    const res = await portalFetch('/api/portal/admin/banks')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.contas)) {
      setContas(data.contas)
    }
  }, [])

  const loadBalances = useCallback(async () => {
    const res = await portalFetch('/api/portal/admin/finance/banks-balance')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.contas)) {
      setBalances(data.contas)
    } else {
      setBalances([])
    }
  }, [])

  const fetchRecurringPending = useCallback(async () => {
    const pendRes = await portalFetch('/api/portal/admin/finance/recurring/pending')
    const pendData = await pendRes?.json().catch(() => null)
    if (pendData?.ok && Array.isArray(pendData.pending)) {
      setRecurringPending(pendData.pending)
    } else {
      setRecurringPending([])
    }
  }, [])

  const loadMovements = useCallback(async () => {
    setLoading(true)
    const [moveRes] = await Promise.all([
      portalFetch(`/api/portal/admin/finance/movements?from=${from}&to=${to}`),
      fetchRecurringPending(),
    ])
    const data = await moveRes?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.movements)) {
      setMovements(data.movements)
    } else {
      setMovements([])
    }
    loadBalances()
    setLoading(false)
  }, [from, to, loadBalances, fetchRecurringPending])

  const applyNewManualTransaction = useCallback((tx: ApiFinancialTransactionRow) => {
    const oc = String(tx.occurred_at ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(oc) || oc < from || oc > to) return
    const contaName = contas.find((c) => c.id === tx.conta_id)?.name ?? ''
    const m = movementFromApiTransaction(tx, contaName)
    const delta = Number(tx.amount_cents) || 0
    setMovements((prev) => {
      const without = prev.filter((x) => x.id !== m.id)
      const next = [...without, m]
      next.sort((a, b) => {
        const d = b.occurred_at.localeCompare(a.occurred_at)
        if (d !== 0) return d
        return (b.created_at || '').localeCompare(a.created_at || '')
      })
      return next
    })
    setBalances((prev) => {
      const idx = prev.findIndex((b) => b.id === tx.conta_id)
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        balance_cents: next[idx].balance_cents + delta,
      }
      return next
    })
  }, [from, to, contas])

  async function syncCurrentPeriodServiceOrders () {
    setIsSyncingServiceOrders(true)
    try {
      const res = await portalFetch(`/api/portal/admin/finance/service-orders/sync?from=${from}&to=${to}`, {
        method: 'POST',
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        const syncedOrders = Number(data.syncedOrders) || 0
        const syncedResaleDevices = Number(data.syncedResaleDevices) || 0
        const syncedPdvSales = Number(data.syncedPdvSales) || 0
        toast({ title: `Dados atualizados (${syncedOrders} OS, ${syncedResaleDevices} aparelhos e ${syncedPdvSales} pedidos Frente de Caixa)` })
        await loadMovements()
      } else {
        toast({ title: 'Não foi possível atualizar os dados', variant: 'destructive' })
      }
    } finally {
      setIsSyncingServiceOrders(false)
    }
  }

  function openSettle (p: RecurringPendingDto) {
    setSettleTarget(p)
    setSettlePaidAt(new Date().toISOString().slice(0, 10))
  }

  async function submitSettle (e: React.FormEvent) {
    e.preventDefault()
    if (!settleTarget) return
    const paidAt = settlePaidAt && /^\d{4}-\d{2}-\d{2}$/.test(settlePaidAt.trim())
      ? settlePaidAt.trim()
      : new Date().toISOString().slice(0, 10)
    setSaving(true)
    try {
      const res = await portalFetch('/api/portal/admin/finance/recurring/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurring_expense_id: settleTarget.id, paid_at: paidAt }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Pagamento registrado' })
        setSettleTarget(null)
        await loadMovements()
      } else {
        const msg = data?.error === 'concurrent_update'
          ? 'Outra alteração ocorreu ao mesmo tempo. Atualize e tente novamente.'
          : (data?.error || 'Erro ao registrar')
        toast({ title: msg, variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  const loadRecurringExpenses = useCallback(async () => {
    setLoadingRecurring(true)
    try {
      const res = await portalFetch('/api/portal/admin/finance/recurring')
      const data = await res?.json().catch(() => null)
      if (data?.ok && Array.isArray(data.recurring)) {
        setRecurringExpenses(data.recurring)
      } else {
        setRecurringExpenses([])
      }
    } finally {
      setLoadingRecurring(false)
    }
  }, [])

  function openRecurringModal () {
    setRecurringDialogOpen(true)
    setNewRecurringDescription('')
    setNewRecurringAmount('')
    setNewRecurringContaId(contas[0]?.id ?? '')
    setNewRecurringBillingDay('1')
    loadRecurringExpenses()
  }

  function openEditRecurring (expense: RecurringExpense) {
    setEditingRecurring(expense)
    setEditingRecurringDescription(expense.description || '')
    setEditingRecurringAmount(maskedFromCents(Math.abs(expense.amount_cents || 0)))
    setEditingRecurringContaId(expense.conta_id || '')
    setEditingRecurringBillingDay(String(expense.billing_day || 1))
    setEditingRecurringActive(Boolean(expense.is_active))
  }

  async function submitEditRecurring (e: React.FormEvent) {
    e.preventDefault()
    if (!editingRecurring) return
    const amountCents = moneyToCentsFromMasked(editingRecurringAmount)
    if (!amountCents || amountCents <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    if (!editingRecurringContaId) {
      toast({ title: 'Selecione a conta', variant: 'destructive' })
      return
    }
    const billingDay = Math.min(31, Math.max(1, Number(editingRecurringBillingDay) || 1))

    setSaving(true)
    try {
      const res = await portalFetch(`/api/portal/admin/finance/recurring/${editingRecurring.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editingRecurringDescription.trim(),
          amount_cents: amountCents,
          conta_id: editingRecurringContaId,
          billing_day: billingDay,
          is_active: editingRecurringActive,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Custo recorrente atualizado' })
        setEditingRecurring(null)
        await loadRecurringExpenses()
        await fetchRecurringPending()
      } else {
        toast({ title: 'Não foi possível atualizar', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function submitCreateRecurring (e: React.FormEvent) {
    e.preventDefault()
    const amountCents = moneyToCentsFromMasked(newRecurringAmount)
    if (!newRecurringDescription.trim()) {
      toast({ title: 'Descrição obrigatória', variant: 'destructive' })
      return
    }
    if (!amountCents || amountCents <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    if (!newRecurringContaId) {
      toast({ title: 'Selecione a conta', variant: 'destructive' })
      return
    }
    const billingDay = Math.min(31, Math.max(1, Number(newRecurringBillingDay) || 1))

    setSaving(true)
    try {
      const res = await portalFetch('/api/portal/admin/finance/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newRecurringDescription.trim(),
          amount_cents: amountCents,
          conta_id: newRecurringContaId,
          billing_day: billingDay,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Custo recorrente criado' })
        setNewRecurringDescription('')
        setNewRecurringAmount('')
        setNewRecurringBillingDay('1')
        await loadRecurringExpenses()
        await fetchRecurringPending()
      } else {
        toast({ title: 'Não foi possível criar', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function removeRecurring (expenseId: string) {
    setSaving(true)
    try {
      const res = await portalFetch(`/api/portal/admin/finance/recurring/${expenseId}`, {
        method: 'DELETE',
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Custo recorrente removido' })
        await loadRecurringExpenses()
        await fetchRecurringPending()
      } else {
        toast({ title: 'Não foi possível remover', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadContas()
  }, [loadContas])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  function openNewRegistro () {
    setDialogOpen(true)
  }

  function openEdit(m: Movement) {
    if (!m.editable || m.source !== 'transaction') return
    setEditingMovement(m)
    setEditAmount(maskedFromCents(Math.abs(m.amount_cents)))
    setEditDescription(m.description)
    setEditOccurredAt(m.occurred_at)
    setEditContaId(m.conta_id ?? '')
    setEditDialogOpen(true)
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMovement || editingMovement.source !== 'transaction' || !editingMovement.editable) return
    const cents = moneyToCentsFromMasked(editAmount)
    if (!cents || cents <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await portalFetch(`/api/portal/admin/finance/transactions/${editingMovement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: cents,
          description: editDescription.trim() || null,
          occurred_at: editOccurredAt || undefined,
          conta_id: editContaId || undefined,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Atualizado' })
        setEditDialogOpen(false)
        setEditingMovement(null)
        loadMovements()
      } else {
        toast({ title: data?.error || 'Erro', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  function openDelete (m: Movement) {
    if (!m.editable || m.source !== 'transaction' || m.transfer_id) return
    setDeletingMovement(m)
    setDeleteDialogOpen(true)
  }

  async function submitDelete () {
    if (!deletingMovement) return
    setSaving(true)
    try {
      const res = await portalFetch(`/api/portal/admin/finance/transactions/${deletingMovement.id}`, {
        method: 'DELETE',
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Registro removido' })
        setDeleteDialogOpen(false)
        setDeletingMovement(null)
        loadMovements()
      } else {
        toast({ title: data?.error || 'Erro ao excluir', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredMovements = sourceFilter === 'all'
    ? movements
    : movements.filter((m) => m.source === sourceFilter)

  const totalEntradas = filteredMovements.filter((m) => m.amount_cents > 0).reduce((s, m) => s + m.amount_cents, 0)
  const totalSaidas = filteredMovements.filter((m) => m.amount_cents < 0).reduce((s, m) => s + Math.abs(m.amount_cents), 0)
  const totalBalance = balances.reduce((s, b) => s + b.balance_cents, 0)

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Movimentação</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-[140px]">
                <CalendarIcon className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.from} value={p.from}>{p.to}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as 'all' | 'os' | 'pdv' | 'seminovo')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tudo</SelectItem>
                <SelectItem value="os">OS</SelectItem>
                <SelectItem value="pdv">Pedidos</SelectItem>
                <SelectItem value="seminovo">Aparelhos</SelectItem>
              </SelectContent>
            </Select>
            {preset === 'custom' && (
              <>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-[145px]"
                  aria-label="Data inicial"
                />
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-[145px]"
                  aria-label="Data final"
                />
              </>
            )}
            <Button
              variant="outline"
              onClick={syncCurrentPeriodServiceOrders}
              disabled={isSyncingServiceOrders}
              size="icon"
              aria-label="Atualizar dados"
            >
              <RotateCw className={`h-4 w-4 ${isSyncingServiceOrders ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={openNewRegistro}>
              <Plus className="h-4 w-4 mr-2" />
              Novo registro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4 text-sm">
            <span className="text-green-600 dark:text-green-400">Entradas: {maskedFromCents(totalEntradas)}</span>
            <span className="text-red-600 dark:text-red-400">Saídas: {maskedFromCents(totalSaidas)}</span>
            <span className="font-medium">Saldo período: {maskedFromCents(totalEntradas - totalSaidas)}</span>
          </div>
          {isSyncingServiceOrders && (
            <p className="mb-3 text-xs text-muted-foreground">
              Sincronizando OS do financeiro...
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma movimentação no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{format(new Date(m.occurred_at + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>
                        {m.service_order_href ? (
                          <Link href={m.service_order_href} className="text-primary hover:underline">
                            {m.description}
                          </Link>
                        ) : m.resale_device_id ? (
                          <Link href={`/portal/revendaaparelhos/${m.resale_device_id}`} className="text-primary hover:underline">
                            {m.description}
                          </Link>
                        ) : m.pos_sale_id ? (
                          <Link href={`/portal/pdv/vendas/${m.pos_sale_id}`} className="text-primary hover:underline">
                            {m.description}
                          </Link>
                        ) : (
                          m.description || '—'
                        )}
                        {m.source === 'pdv' && (
                          <span className="ml-1 text-xs text-muted-foreground">(somente editável na Frente de Caixa)</span>
                        )}
                      </TableCell>
                      <TableCell>{m.conta_name || '—'}</TableCell>
                      <TableCell className={`text-right font-medium ${m.amount_cents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {m.amount_cents >= 0 ? '+' : ''}{maskedFromCents(m.amount_cents)}
                      </TableCell>
                      <TableCell>
                        {m.editable && m.source === 'transaction' && !m.transfer_id && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDelete(m)} aria-label="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>

      <aside className="w-64 shrink-0">
        <Button
          type="button"
          variant="outline"
          className="w-full mb-3"
          onClick={openRecurringModal}
        >
          Gerenciar custos recorrentes
        </Button>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Saldos atuais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.map((b) => (
              <div key={b.id} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground truncate">{b.name}</span>
                <span className={`font-medium tabular-nums shrink-0 ml-2 ${b.balance_cents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {maskedFromCents(b.balance_cents)}
                </span>
              </div>
            ))}
            {balances.length > 0 && (
              <div className="pt-2 border-t flex justify-between items-center font-medium">
                <span>Total</span>
                <span className={`tabular-nums ${totalBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {maskedFromCents(totalBalance)}
                </span>
              </div>
            )}
            {balances.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recorrentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && recurringPending.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recurringPending.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conta recorrente.</p>
            ) : (
              recurringPending.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-md border p-2.5 space-y-2 ${p.is_active ? '' : 'opacity-70'}`}
                >
                  <p className="text-sm font-medium leading-snug line-clamp-2" title={p.description}>
                    {p.description}
                    {!p.is_active ? (
                      <span className="text-muted-foreground font-normal"> (inativo)</span>
                    ) : null}
                  </p>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      {format(new Date(`${p.due_date}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                    <span className="font-medium tabular-nums text-red-600 dark:text-red-400 shrink-0">
                      {maskedFromCents(-Math.abs(p.amount_cents))}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => openSettle(p)}
                  >
                    Marcar como paga
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </aside>

      <FinanceiroNovoRegistroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contas={contas}
        onManualTransactionCreated={applyNewManualTransaction}
        onRecurringCreated={fetchRecurringPending}
      />

      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) setEditingMovement(null); setEditDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pagamento</DialogTitle>
            <DialogDescription>Ajuste valor, descrição, data ou conta.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                value={editAmount}
                onChange={(e) => setEditAmount(formatMoneyInput(e.target.value))}
                placeholder="0,00"
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={editOccurredAt}
                onChange={(e) => setEditOccurredAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Conta</Label>
              <Select value={editContaId} onValueChange={setEditContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) setDeletingMovement(null); setDeleteDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir registro</DialogTitle>
            <DialogDescription>
              Esta ação remove permanentemente a movimentação financeira selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Descrição:</span> {deletingMovement?.description || '—'}</p>
            <p><span className="text-muted-foreground">Valor:</span> {deletingMovement ? maskedFromCents(deletingMovement.amount_cents) : '—'}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={submitDelete}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Custos recorrentes</DialogTitle>
            <DialogDescription>Lista de custos recorrentes cadastrados.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreateRecurring} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end border rounded-md p-3">
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={newRecurringDescription}
                onChange={(e) => setNewRecurringDescription(e.target.value)}
                placeholder="Ex.: Aluguel"
              />
            </div>
            <div>
              <Label>Valor</Label>
              <Input
                value={newRecurringAmount}
                onChange={(e) => setNewRecurringAmount(formatMoneyInput(e.target.value))}
                inputMode="numeric"
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Conta</Label>
              <Select value={newRecurringContaId} onValueChange={setNewRecurringContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={newRecurringBillingDay}
                onChange={(e) => setNewRecurringBillingDay(e.target.value)}
              />
            </div>
            <div className="md:col-span-5">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Novo custo recorrente'}
              </Button>
            </div>
          </form>
          {loadingRecurring ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recurringExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum custo recorrente cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[110px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringExpenses.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.description}</TableCell>
                    <TableCell>{contas.find((c) => c.id === r.conta_id)?.name ?? '—'}</TableCell>
                    <TableCell>{r.billing_day}</TableCell>
                    <TableCell>{maskedFromCents(-Math.abs(r.amount_cents || 0)).replace('-', '')}</TableCell>
                    <TableCell>{r.is_active ? 'Ativo' : 'Inativo'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditRecurring(r)}
                          aria-label="Editar custo recorrente"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRecurring(r.id)}
                          aria-label="Excluir custo recorrente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(settleTarget)} onOpenChange={(open) => { if (!open) setSettleTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como paga</DialogTitle>
            <DialogDescription>
              Será lançada uma saída na conta com o valor do custo recorrente. Informe a data em que o pagamento foi efetuado.
            </DialogDescription>
          </DialogHeader>
          {settleTarget ? (
            <form onSubmit={submitSettle} className="space-y-4">
              <div className="text-sm space-y-1 rounded-md border p-3 bg-muted/40">
                <p><span className="text-muted-foreground">Descrição:</span> {settleTarget.description}</p>
                <p><span className="text-muted-foreground">Valor:</span> {maskedFromCents(-Math.abs(settleTarget.amount_cents))}</p>
                <p><span className="text-muted-foreground">Competência:</span> {settleTarget.competency_month}</p>
                <p><span className="text-muted-foreground">Vencimento:</span> {format(new Date(`${settleTarget.due_date}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })}</p>
              </div>
              <div>
                <Label htmlFor="settle-paid-at">Data do pagamento</Label>
                <Input
                  id="settle-paid-at"
                  type="date"
                  value={settlePaidAt}
                  onChange={(e) => setSettlePaidAt(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSettleTarget(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar pagamento'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingRecurring)} onOpenChange={(open) => { if (!open) setEditingRecurring(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar custo recorrente</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEditRecurring} className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input
                value={editingRecurringDescription}
                onChange={(e) => setEditingRecurringDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                value={editingRecurringAmount}
                onChange={(e) => setEditingRecurringAmount(formatMoneyInput(e.target.value))}
                inputMode="numeric"
              />
            </div>
            <div>
              <Label>Conta</Label>
              <Select value={editingRecurringContaId} onValueChange={setEditingRecurringContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia da fatura</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={editingRecurringBillingDay}
                onChange={(e) => setEditingRecurringBillingDay(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editingRecurringActive} onCheckedChange={setEditingRecurringActive} />
              <Label>Ativo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRecurring(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
