'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, ArrowRightLeft, Plus, Loader2, Settings, Scale } from 'lucide-react'
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
import { toast } from '@/hooks/use-toast'
import { maskedFromCents } from '@/lib/utils/money'
import { formatMoneyInput, formatMoneyInputSigned, moneyToCentsFromMasked, moneyToCentsFromMaskedSigned } from '@/lib/utils/money'
import { portalFetch } from '@/lib/portal/portal-fetch'

type BankBalance = { id: string; name: string; balance_cents: number; saldo_inicial_cents?: number }

export function FinanceiroBancosClient() {
  const [banks, setBanks] = useState<BankBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [balanceBaseDialogOpen, setBalanceBaseDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [newBankDialogOpen, setNewBankDialogOpen] = useState(false)
  const [editContaDialogOpen, setEditContaDialogOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<BankBalance | null>(null)
  const [newBalanceValue, setNewBalanceValue] = useState('')
  const [adjustDescription, setAdjustDescription] = useState('')
  const [balanceBaseValue, setBalanceBaseValue] = useState('')
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [newBankName, setNewBankName] = useState('')
  const [newSaldoInicial, setNewSaldoInicial] = useState('')
  const [editContaName, setEditContaName] = useState('')
  const [editSaldoInicial, setEditSaldoInicial] = useState('')
  const [saving, setSaving] = useState(false)

  const loadBanks = useCallback(async () => {
    setLoading(true)
    const res = await portalFetch('/api/portal/admin/finance/banks-balance')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.contas)) {
      setBanks(data.contas)
    } else {
      setBanks([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBanks()
  }, [loadBanks])

  function openAdjust(bank: BankBalance) {
    setEditingBank(bank)
    setNewBalanceValue(maskedFromCents(bank.balance_cents))
    setAdjustDescription('Ajuste de saldo')
    setAdjustDialogOpen(true)
  }

  function openEditConta(bank: BankBalance) {
    setEditingBank(bank)
    setEditContaName(bank.name)
    setEditSaldoInicial(maskedFromCents(bank.saldo_inicial_cents ?? 0))
    setEditContaDialogOpen(true)
  }

  function openBalanceBaseUpdate(bank: BankBalance) {
    setEditingBank(bank)
    setBalanceBaseValue(maskedFromCents(bank.balance_cents))
    setBalanceBaseDialogOpen(true)
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBank) return
    const cents = moneyToCentsFromMaskedSigned(newBalanceValue)
    if (cents === null) {
      toast({ title: 'Informe o novo saldo', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await portalFetch('/api/portal/admin/finance/balance-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conta_id: editingBank.id,
          new_balance_cents: cents,
          description: adjustDescription.trim() || 'Ajuste de saldo',
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Saldo ajustado. Foi gerada uma entrada ou saída de ajuste.' })
        setAdjustDialogOpen(false)
        setEditingBank(null)
        loadBanks()
      } else {
        toast({ title: data?.error || 'Erro', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  function openTransfer() {
    setTransferFrom(banks[0]?.id ?? '')
    setTransferTo(banks[1]?.id ?? banks[0]?.id ?? '')
    setTransferAmount('')
    setTransferDialogOpen(true)
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault()
    const cents = moneyToCentsFromMasked(transferAmount)
    if (!cents || cents <= 0) {
      toast({ title: 'Informe o valor', variant: 'destructive' })
      return
    }
    if (!transferFrom || !transferTo || transferFrom === transferTo) {
      toast({ title: 'Selecione origem e destino diferentes', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await portalFetch('/api/portal/admin/finance/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_conta_id: transferFrom,
          to_conta_id: transferTo,
          amount_cents: cents,
          description: 'Transferência entre contas',
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Transferência realizada (transação neutra)' })
        setTransferDialogOpen(false)
        loadBanks()
      } else {
        toast({ title: data?.error || 'Erro', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function submitBalanceBaseUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBank) return
    const cents = moneyToCentsFromMaskedSigned(balanceBaseValue)
    if (cents === null) {
      toast({ title: 'Informe o novo balanço', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await portalFetch('/api/portal/admin/finance/balance-base-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conta_id: editingBank.id,
          new_balance_cents: cents,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Balanço atualizado sem lançar movimentação.' })
        setBalanceBaseDialogOpen(false)
        setEditingBank(null)
        loadBanks()
      } else {
        toast({ title: data?.message || data?.error || 'Erro', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function submitNewBank(e: React.FormEvent) {
    e.preventDefault()
    const name = newBankName.trim()
    if (!name) {
      toast({ title: 'Nome da conta é obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const saldoCents = moneyToCentsFromMaskedSigned(newSaldoInicial)
      const res = await portalFetch('/api/portal/admin/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          saldo_inicial_cents: saldoCents ?? 0,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Conta cadastrada' })
        setNewBankDialogOpen(false)
        setNewBankName('')
        setNewSaldoInicial('')
        loadBanks()
      } else {
        toast({ title: data?.error || 'Erro', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function submitEditConta(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBank) return
    const name = editContaName.trim()
    if (!name) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const saldoCents = moneyToCentsFromMaskedSigned(editSaldoInicial)
      const res = await portalFetch(`/api/portal/admin/banks/${editingBank.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          saldo_inicial_cents: saldoCents ?? 0,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Conta atualizada' })
        setEditContaDialogOpen(false)
        setEditingBank(null)
        loadBanks()
      } else {
        toast({ title: data?.error || 'Erro', variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  const totalCents = banks.reduce((s, b) => s + b.balance_cents, 0)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Contas</CardTitle>
            <CardDescription>
              Saldo por conta. Cada forma de pagamento pode ser vinculada a uma conta em Configurações gerais → Formas de pagamento. Editar saldo gera entrada/saída de ajuste; atualizar balanço corrige sem gerar movimentação.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openTransfer}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Transferir entre contas
            </Button>
            <Button onClick={() => setNewBankDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova conta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm font-medium">
            Saldo total: {maskedFromCents(totalCents)}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhuma conta. Cadastre uma e vincule formas de pagamento em Dados da empresa.
                    </TableCell>
                  </TableRow>
                ) : (
                  banks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.name}</TableCell>
                      <TableCell className={`text-right font-medium ${b.balance_cents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {maskedFromCents(b.balance_cents)}
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditConta(b)} aria-label="Editar conta">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openBalanceBaseUpdate(b)} aria-label="Atualizar balanço sem movimento">
                          <Scale className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openAdjust(b)} aria-label="Ajustar saldo">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={adjustDialogOpen} onOpenChange={(o) => { if (!o) setEditingBank(null); setAdjustDialogOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar saldo</DialogTitle>
            <DialogDescription>
              Informe o novo saldo. Será criada uma entrada ou saída de ajuste para igualar ao valor informado.
            </DialogDescription>
          </DialogHeader>
          {editingBank && (
            <form onSubmit={submitAdjust} className="space-y-4">
              <p className="text-sm text-muted-foreground">Conta: {editingBank.name}</p>
              <div>
                <Label>Novo saldo (R$)</Label>
                <Input
                  value={newBalanceValue}
                  onChange={(e) => setNewBalanceValue(formatMoneyInputSigned(e.target.value))}
                  placeholder="-0,00"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground mt-1">Use o sinal de menos no início para saldo negativo (ex.: -150,00).</p>
              </div>
              <div>
                <Label>Descrição do ajuste (opcional)</Label>
                <Input
                  value={adjustDescription}
                  onChange={(e) => setAdjustDescription(e.target.value)}
                  placeholder="Ajuste de saldo"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajustar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={balanceBaseDialogOpen} onOpenChange={(o) => { if (!o) setEditingBank(null); setBalanceBaseDialogOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar balanço (sem movimentação)</DialogTitle>
            <DialogDescription>
              Define o saldo atual da conta sem criar lançamento de entrada/saída. O histórico de movimentações permanece intacto.
            </DialogDescription>
          </DialogHeader>
          {editingBank && (
            <form onSubmit={submitBalanceBaseUpdate} className="space-y-4">
              <p className="text-sm text-muted-foreground">Conta: {editingBank.name}</p>
              <div>
                <Label>Novo balanço atual (R$)</Label>
                <Input
                  value={balanceBaseValue}
                  onChange={(e) => setBalanceBaseValue(formatMoneyInputSigned(e.target.value))}
                  placeholder="-0,00"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground mt-1">Digite o sinal de menos no início para valor negativo (ex.: -100,00).</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBalanceBaseDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar balanço'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir entre contas</DialogTitle>
            <DialogDescription>
              Transação neutra: o valor sai de uma conta e entra na outra (não conta como entrada/saída total).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTransfer} className="space-y-4">
            <div>
              <Label>Origem</Label>
              <Select value={transferFrom} onValueChange={setTransferFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destino</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                value={transferAmount}
                onChange={(e) => setTransferAmount(formatMoneyInput(e.target.value))}
                placeholder="0,00"
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Transferir'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editContaDialogOpen} onOpenChange={(o) => { if (!o) setEditingBank(null); setEditContaDialogOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar conta</DialogTitle>
            <DialogDescription>Altere o nome ou o saldo inicial da conta.</DialogDescription>
          </DialogHeader>
          {editingBank && (
            <form onSubmit={submitEditConta} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editContaName}
                  onChange={(e) => setEditContaName(e.target.value)}
                  placeholder="Ex.: Conta corrente"
                />
              </div>
              <div>
                <Label>Saldo inicial (R$)</Label>
                <Input
                  value={editSaldoInicial}
                  onChange={(e) => setEditSaldoInicial(formatMoneyInputSigned(e.target.value))}
                  placeholder="0,00"
                  inputMode="numeric"
                  autoComplete="off"
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground mt-1">Valor que a conta tinha ao ser aberta ou configurada. Pode ser negativo.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditContaDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={newBankDialogOpen} onOpenChange={setNewBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
            <DialogDescription>Cadastre uma conta para vincular às formas de pagamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNewBank} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="Ex.: Conta corrente, Caixa"
              />
            </div>
            <div>
              <Label>Saldo inicial (R$) — opcional</Label>
              <Input
                value={newSaldoInicial}
                onChange={(e) => setNewSaldoInicial(formatMoneyInputSigned(e.target.value))}
                placeholder="0,00"
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground mt-1">Valor que a conta tem ao ser criada. Pode ser negativo.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewBankDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
