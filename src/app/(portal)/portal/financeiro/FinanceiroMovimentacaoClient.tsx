'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Pencil, Loader2, CalendarIcon } from 'lucide-react'
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

type Movement = {
  id: string
  source: 'transaction' | 'os' | 'seminovo'
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
  resale_device_id: string | null
  editable: boolean
}

type Bank = { id: string; name: string }

type ContaBalance = { id: string; name: string; balance_cents: number }

const PRESETS = [
  { from: 'thisMonth', to: 'Este mês' },
  { from: 'lastMonth', to: 'Mês passado' },
  { from: 'thisYear', to: 'Este ano' },
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
  const [movements, setMovements] = useState<Movement[]>([])
  const [contas, setContas] = useState<Bank[]>([])
  const [balances, setBalances] = useState<ContaBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [formType, setFormType] = useState<'entrada' | 'saida'>('entrada')
  const [formOccurredAt, setFormOccurredAt] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formContaId, setFormContaId] = useState('')
  const [formBillingDay, setFormBillingDay] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editOccurredAt, setEditOccurredAt] = useState('')
  const [editContaId, setEditContaId] = useState('')

  const { from, to } = buildRange(preset)

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

  const loadMovements = useCallback(async () => {
    setLoading(true)
    await portalFetch('/api/portal/admin/finance/recurring/generate', { method: 'POST' })
    const res = await portalFetch(`/api/portal/admin/finance/movements?from=${from}&to=${to}`)
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.movements)) {
      setMovements(data.movements)
    } else {
      setMovements([])
    }
    loadBalances()
    setLoading(false)
  }, [from, to, loadBalances])

  useEffect(() => {
    loadContas()
  }, [loadContas])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  function openNewRegistro() {
    setFormDescription('')
    setFormAmount('')
    setFormType('entrada')
    setFormOccurredAt(new Date().toISOString().slice(0, 10))
    setFormContaId(contas[0]?.id ?? '')
    setFormBillingDay(String(new Date().getDate()))
    setIsRecurring(false)
    setDialogOpen(true)
  }

  async function submitNewRegistro(e: React.FormEvent) {
    e.preventDefault()
    const cents = moneyToCentsFromMasked(formAmount)
    if (!cents || cents <= 0) {
      toast({ title: 'Informe o valor', variant: 'destructive' })
      return
    }
    if (!formContaId) {
      toast({ title: 'Selecione a conta', variant: 'destructive' })
      return
    }
    const occurredAt = formOccurredAt && /^\d{4}-\d{2}-\d{2}$/.test(formOccurredAt) ? formOccurredAt : new Date().toISOString().slice(0, 10)
    setSaving(true)
    try {
      if (isRecurring && formType === 'saida') {
        const billingDay = Math.min(31, Math.max(1, parseInt(formBillingDay, 10) || 1))
        const res = await portalFetch('/api/portal/admin/finance/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formDescription.trim() || 'Gasto recorrente',
            amount_cents: cents,
            conta_id: formContaId,
            billing_day: billingDay,
          }),
        })
        const data = await res?.json().catch(() => null)
        if (data?.ok) {
          toast({ title: 'Gasto recorrente cadastrado' })
          setDialogOpen(false)
          loadMovements()
        } else {
          toast({ title: data?.error || 'Erro ao salvar', variant: 'destructive' })
        }
      } else {
        const res = await portalFetch('/api/portal/admin/finance/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: formType,
            amount_cents: cents,
            conta_id: formContaId,
            description: formDescription.trim() || null,
            occurred_at: occurredAt,
          }),
        })
        const data = await res?.json().catch(() => null)
        if (data?.ok) {
          toast({ title: formType === 'entrada' ? 'Entrada registrada' : 'Saída registrada' })
          setDialogOpen(false)
          loadMovements()
        } else {
          toast({ title: data?.error || 'Erro ao salvar', variant: 'destructive' })
        }
      }
    } finally {
      setSaving(false)
    }
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

  const totalEntradas = movements.filter((m) => m.amount_cents > 0).reduce((s, m) => s + m.amount_cents, 0)
  const totalSaidas = movements.filter((m) => m.amount_cents < 0).reduce((s, m) => s + Math.abs(m.amount_cents), 0)
  const totalBalance = balances.reduce((s, b) => s + b.balance_cents, 0)

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Movimentação</CardTitle>
            <CardDescription>
              Entradas e saídas (incluindo OS). Valores editáveis apenas nas transações manuais; OS somente na tela da ordem.
            </CardDescription>
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
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma movimentação no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{format(new Date(m.occurred_at + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>
                        {m.service_order_id ? (
                          <Link href={`/portal/ordens/${m.service_order_id}`} className="text-primary hover:underline">
                            {m.description}
                          </Link>
                        ) : m.resale_device_id ? (
                          <Link href={`/portal/seminovos/${m.resale_device_id}`} className="text-primary hover:underline">
                            {m.description}
                          </Link>
                        ) : (
                          m.description || '—'
                        )}
                        {m.source === 'os' && (
                          <span className="ml-1 text-xs text-muted-foreground">(somente editável na OS)</span>
                        )}
                        {m.source === 'seminovo' && (
                          <span className="ml-1 text-xs text-muted-foreground">(somente editável em Seminovos)</span>
                        )}
                      </TableCell>
                      <TableCell>{m.conta_name || '—'}</TableCell>
                      <TableCell className={`text-right font-medium ${m.amount_cents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {m.amount_cents >= 0 ? '+' : ''}{maskedFromCents(m.amount_cents)}
                      </TableCell>
                      <TableCell>
                        {m.editable && m.source === 'transaction' && !m.transfer_id && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
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
      </aside>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo registro</DialogTitle>
            <DialogDescription>Registre uma entrada ou saída na conta.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNewRegistro} className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={(v) => { setFormType(v as 'entrada' | 'saida'); if (v === 'entrada') setIsRecurring(false) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (positivo)</SelectItem>
                  <SelectItem value="saida">Gasto (negativo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data da movimentação</Label>
              <Input
                type="date"
                value={formOccurredAt}
                onChange={(e) => setFormOccurredAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                value={formAmount}
                onChange={(e) => setFormAmount(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Conta</Label>
              <Select value={formContaId} onValueChange={setFormContaId}>
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
              <Label>Descrição</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex.: Venda, aluguel, energia..."
              />
            </div>
            {formType === 'saida' && (
              <>
                <div className="flex items-center gap-2">
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                  <Label>Gasto recorrente (dia da fatura)</Label>
                </div>
                {isRecurring && (
                  <div>
                    <Label>Dia da fatura (1-31)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={formBillingDay}
                      onChange={(e) => setFormBillingDay(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
