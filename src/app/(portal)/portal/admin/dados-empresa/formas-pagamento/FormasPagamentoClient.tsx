'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { appConfirm } from '@/lib/ui/app-dialogs'

const PAYMENT_TYPES = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix_direto', label: 'PIX direto' },
  { value: 'pix_maquina', label: 'PIX máquina' },
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
] as const

type CreditInstallmentFee = { installments: number; fee_percent: number }

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: CreditInstallmentFee[]
  sort_order: number
  conta_id?: string | null
}

type Bank = { id: string; name: string }

type Props = {
  initialPaymentMethods: PaymentMethod[]
}

export function FormasPagamentoClient({ initialPaymentMethods }: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<string>('dinheiro')
  const [formFeePercent, setFormFeePercent] = useState('')
  const [formCreditFees, setFormCreditFees] = useState<CreditInstallmentFee[]>([])
  const [formContaId, setFormContaId] = useState<string>('')
  const [contas, setContas] = useState<Bank[]>([])

  const loadPaymentMethods = useCallback(async () => {
    const res = await portalFetch('/api/portal/admin/payment-methods')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.paymentMethods)) {
      setPaymentMethods(data.paymentMethods)
    }
  }, [])

  const loadBanks = useCallback(async () => {
    const res = await portalFetch('/api/portal/admin/banks')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.contas)) setContas(data.contas)
  }, [])

  useEffect(() => {
    loadPaymentMethods()
  }, [loadPaymentMethods])

  useEffect(() => {
    loadBanks()
  }, [loadBanks])

  const hasFees = ['pix_direto', 'pix_maquina', 'credito', 'debito'].includes(formType)

  function openCreate() {
    setEditingId(null)
    setFormDescription('')
    setFormType('dinheiro')
    setFormFeePercent('')
    setFormCreditFees([])
    setFormContaId('__none__')
    setDialogOpen(true)
  }

  function openEdit(pm: PaymentMethod) {
    setEditingId(pm.id)
    setFormDescription(pm.description)
    setFormType(pm.type)
    setFormFeePercent(String(pm.fee_percent ?? ''))
    setFormCreditFees(Array.isArray(pm.credit_installment_fees) ? pm.credit_installment_fees : [])
    setFormContaId(pm.conta_id ?? '__none__')
    setDialogOpen(true)
  }

  function addCreditInstallment() {
    const maxInstallments = formCreditFees.length > 0
      ? Math.max(...formCreditFees.map((f) => f.installments))
      : 0
    setFormCreditFees((prev) => [
      ...prev,
      { installments: maxInstallments + 1, fee_percent: 0 },
    ])
  }

  function updateCreditFee(index: number, field: 'installments' | 'fee_percent', value: number) {
    setFormCreditFees((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    )
  }

  function removeCreditFee(index: number) {
    setFormCreditFees((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formDescription.trim()) {
      toast({ title: 'Descrição é obrigatória', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      const feePercent = parseFloat(formFeePercent) || 0
      const body = {
        description: formDescription.trim(),
        type: formType,
        fee_percent: feePercent,
        credit_installment_fees: formType === 'credito' ? formCreditFees : [],
        conta_id: formContaId === '__none__' ? null : formContaId,
      }

      if (editingId) {
        const res = await portalFetch(`/api/portal/admin/payment-methods/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res?.json().catch(() => null)
        if (!res?.ok || !data?.ok) {
          toast({ title: 'Erro ao salvar', variant: 'destructive' })
          return
        }
        toast({ title: 'Forma de pagamento atualizada' })
      } else {
        const res = await portalFetch('/api/portal/admin/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res?.json().catch(() => null)
        if (!res?.ok || !data?.ok) {
          toast({ title: 'Erro ao cadastrar', variant: 'destructive' })
          return
        }
        toast({ title: 'Forma de pagamento cadastrada' })
      }

      setDialogOpen(false)
      loadPaymentMethods()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm({
      title: 'Excluir forma de pagamento?',
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    }))) return

    const res = await portalFetch(`/api/portal/admin/payment-methods/${id}`, {
      method: 'DELETE',
    })
    const data = await res?.json().catch(() => null)
    if (!res?.ok || !data?.ok) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
      return
    }
    toast({ title: 'Forma de pagamento excluída' })
    loadPaymentMethods()
  }

  function getTypeLabel(type: string) {
    return PAYMENT_TYPES.find((t) => t.value === type)?.label ?? type
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Formas de pagamento</CardTitle>
              <CardDescription>
                Cadastre as formas de pagamento aceitas pela empresa, com descrição, tipo e taxas.
              </CardDescription>
            </div>
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma forma de pagamento cadastrada. Clique em &quot;Nova&quot; para adicionar.
            </p>
          ) : (
            <ul className="space-y-2">
              {paymentMethods.map((pm) => (
                <li
                  key={pm.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{pm.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {getTypeLabel(pm.type)}
                      {pm.conta_id && contas.length > 0 && (
                        <> • Conta: {contas.find((c) => c.id === pm.conta_id)?.name ?? pm.conta_id}</>
                      )}
                      {pm.fee_percent > 0 && ` • Taxa: ${pm.fee_percent}%`}
                      {pm.type === 'credito' &&
                        Array.isArray(pm.credit_installment_fees) &&
                        pm.credit_installment_fees.length > 0 && (
                          <>
                            {' • Parcelas: '}
                            {pm.credit_installment_fees
                              .map((f) => `${f.installments}x ${f.fee_percent}%`)
                              .join(', ')}
                          </>
                        )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(pm)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(pm.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} forma de pagamento</DialogTitle>
            <DialogDescription>
              Preencha a descrição, tipo e taxas quando aplicável.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Ex: PIX à vista"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de pagamento</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta (Financeiro)</Label>
              <Select value={formContaId} onValueChange={setFormContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Vincula esta forma de pagamento a uma conta para saldo no Financeiro.</p>
            </div>

            {hasFees && (
              <div className="space-y-3">
                <Label>Informações e taxas</Label>

                {formType !== 'credito' && (
                  <div className="space-y-2">
                    <Label htmlFor="fee_percent" className="text-sm font-normal">
                      Taxa (%)
                    </Label>
                    <Input
                      id="fee_percent"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formFeePercent}
                      onChange={(e) => setFormFeePercent(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}

                {formType === 'credito' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Taxa por parcela</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addCreditInstallment}>
                        <Plus className="h-3 w-3 mr-1" />
                        Parcela
                      </Button>
                    </div>
                    {formCreditFees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Adicione parcelas para definir a taxa de cada uma.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {formCreditFees.map((f, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <Input
                              type="number"
                              min="1"
                              value={f.installments}
                              onChange={(e) =>
                                updateCreditFee(i, 'installments', parseInt(e.target.value, 10) || 1)
                              }
                              className="w-20"
                            />
                            <span className="text-sm">x</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={f.fee_percent}
                              onChange={(e) =>
                                updateCreditFee(i, 'fee_percent', parseFloat(e.target.value) || 0)
                              }
                              placeholder="Taxa %"
                              className="flex-1"
                            />
                            <span className="text-sm">%</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCreditFee(i)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
