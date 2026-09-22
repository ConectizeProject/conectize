'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
] as const

const PAYMENT_TYPE_ORDER = PAYMENT_TYPES.map((type) => type.value)

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

type PaymentTypeGroup = {
  type: string
  label: string
  methods: PaymentMethod[]
}

type AccountGroup = {
  key: string
  name: string
  types: PaymentTypeGroup[]
}

type Props = {
  initialPaymentMethods: PaymentMethod[]
  initialContas?: Bank[]
}

function formatFeePercent (value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function typeSortIndex (type: string) {
  const index = (PAYMENT_TYPE_ORDER as readonly string[]).indexOf(type)
  return index === -1 ? PAYMENT_TYPE_ORDER.length : index
}

function sortedInstallmentFees (fees: CreditInstallmentFee[]) {
  return [...fees].sort((a, b) => a.installments - b.installments)
}

function groupPaymentMethods (methods: PaymentMethod[], contas: Bank[]): AccountGroup[] {
  const contaNameById = new Map(contas.map((conta) => [conta.id, conta.name]))
  const byAccount = new Map<string, PaymentMethod[]>()

  for (const method of methods) {
    const key = method.conta_id || '__none__'
    const list = byAccount.get(key) ?? []
    list.push(method)
    byAccount.set(key, list)
  }

  const groups: AccountGroup[] = []

  for (const [key, accountMethods] of byAccount) {
    const byType = new Map<string, PaymentMethod[]>()
    for (const method of accountMethods) {
      const typeList = byType.get(method.type) ?? []
      typeList.push(method)
      byType.set(method.type, typeList)
    }

    const types: PaymentTypeGroup[] = [...byType.entries()]
      .map(([type, typeMethods]) => ({
        type,
        label: PAYMENT_TYPES.find((item) => item.value === type)?.label ?? type,
        methods: [...typeMethods].sort((a, b) =>
          a.sort_order - b.sort_order || a.description.localeCompare(b.description, 'pt-BR')
        ),
      }))
      .sort((a, b) => typeSortIndex(a.type) - typeSortIndex(b.type))

    groups.push({
      key,
      name: key === '__none__'
        ? 'Sem conta'
        : (contaNameById.get(key) ?? 'Conta'),
      types,
    })
  }

  groups.sort((a, b) => {
    if (a.key === '__none__') return 1
    if (b.key === '__none__') return -1
    const aOrder = Math.min(...a.types.flatMap((typeGroup) => typeGroup.methods.map((method) => method.sort_order)))
    const bOrder = Math.min(...b.types.flatMap((typeGroup) => typeGroup.methods.map((method) => method.sort_order)))
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  return groups
}

export function FormasPagamentoClient({ initialPaymentMethods, initialContas = [] }: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<string>('dinheiro')
  const [formFeePercent, setFormFeePercent] = useState('')
  const [formCreditFees, setFormCreditFees] = useState<CreditInstallmentFee[]>([])
  const [formContaId, setFormContaId] = useState<string>('')
  const [contas, setContas] = useState<Bank[]>(initialContas)
  const accountGroups = useMemo(
    () => groupPaymentMethods(paymentMethods, contas),
    [paymentMethods, contas]
  )

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

  return (
    <div className="max-w-4xl space-y-6">
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
            <div className="space-y-4">
              {accountGroups.map((group) => (
                <section key={group.key} className="overflow-hidden rounded-lg border">
                  <h3 className="border-b bg-muted/50 px-4 py-2.5 text-sm font-semibold">
                    {group.name}
                  </h3>
                  <ul className="divide-y">
                    {group.types.map((typeGroup) => (
                      <li key={typeGroup.type} className="space-y-3 px-4 py-3">
                        {typeGroup.methods.map((pm) => {
                          const installmentFees = pm.type === 'credito'
                            ? sortedInstallmentFees(
                              Array.isArray(pm.credit_installment_fees) ? pm.credit_installment_fees : []
                            )
                            : []
                          const showsInstallments = installmentFees.length > 0
                          const showsFee = !showsInstallments && pm.fee_percent > 0

                          return (
                            <div key={pm.id} className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {typeGroup.label}
                                    {showsFee ? (
                                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                                        {formatFeePercent(pm.fee_percent)}
                                      </span>
                                    ) : null}
                                  </p>
                                  {typeGroup.methods.length > 1 ? (
                                    <p className="truncate text-sm text-muted-foreground">{pm.description}</p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(pm)}
                                    aria-label={`Editar ${typeGroup.label}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(pm.id)}
                                    aria-label={`Excluir ${typeGroup.label}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {showsInstallments ? (
                                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                                  {installmentFees.map((fee) => (
                                    <li
                                      key={fee.installments}
                                      className="rounded-md border bg-muted/30 px-2.5 py-2"
                                    >
                                      <p className="text-xs text-muted-foreground">{fee.installments}x</p>
                                      <p className="text-sm font-medium tabular-nums">
                                        {formatFeePercent(fee.fee_percent)}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          )
                        })}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
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
