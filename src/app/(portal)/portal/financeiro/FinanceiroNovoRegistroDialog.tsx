'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { formatMoneyInput, moneyToCentsFromMasked } from '@/lib/utils/money'
import { portalFetch } from '@/lib/portal/portal-fetch'

type ContaOption = { id: string; name: string }

/** Linha retornada por POST /finance/transactions (Supabase). */
export type ApiFinancialTransactionRow = {
  id: string
  conta_id: string
  amount_cents: number
  type?: string
  description?: string | null
  occurred_at: string
  created_at: string
  transfer_id?: string | null
  recurring_expense_id?: string | null
}

type FinanceiroNovoRegistroDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contas: ContaOption[]
  onManualTransactionCreated: (tx: ApiFinancialTransactionRow) => void | Promise<void>
  onRecurringCreated: () => void | Promise<void>
}

export function FinanceiroNovoRegistroDialog ({
  open,
  onOpenChange,
  contas,
  onManualTransactionCreated,
  onRecurringCreated,
}: FinanceiroNovoRegistroDialogProps) {
  const [formType, setFormType] = useState<'entrada' | 'saida'>('entrada')
  const [formOccurredAt, setFormOccurredAt] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formContaId, setFormContaId] = useState('')
  const [formBillingDay, setFormBillingDay] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setFormDescription('')
    setFormAmount('')
    setFormType('entrada')
    setFormOccurredAt(new Date().toISOString().slice(0, 10))
    setFormContaId(contas[0]?.id ?? '')
    setFormBillingDay(String(new Date().getDate()))
    setIsRecurring(false)
    // Somente ao abrir; não depende de `contas` para não limpar o formulário quando as contas chegam depois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || formContaId) return
    const first = contas[0]?.id
    if (first) setFormContaId(first)
  }, [open, contas, formContaId])

  async function submitNewRegistro (e: React.FormEvent) {
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
    const occurredAt = formOccurredAt && /^\d{4}-\d{2}-\d{2}$/.test(formOccurredAt)
      ? formOccurredAt
      : new Date().toISOString().slice(0, 10)
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
          onOpenChange(false)
          await onRecurringCreated()
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
        if (data?.ok && data.transaction) {
          toast({ title: formType === 'entrada' ? 'Entrada registrada' : 'Saída registrada' })
          onOpenChange(false)
          await onManualTransactionCreated(data.transaction as ApiFinancialTransactionRow)
        } else {
          toast({ title: data?.error || 'Erro ao salvar', variant: 'destructive' })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo registro</DialogTitle>
          <DialogDescription>Registre uma entrada ou saída na conta.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitNewRegistro} className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select
              value={formType}
              onValueChange={(v) => {
                setFormType(v as 'entrada' | 'saida')
                if (v === 'entrada') setIsRecurring(false)
              }}
            >
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
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
