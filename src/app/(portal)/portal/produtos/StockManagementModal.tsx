'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type Movement = {
  id: string
  productId: string
  type: 'entry' | 'exit' | 'loss'
  quantity: number
  unitValueCents: number
  totalValueCents: number
  source: string
  externalReference: string | null
  createdAt: string
}

type StockData = {
  currentStock: number
  movements: Movement[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  productName: string
  costPriceCents?: number | null
  initialStock?: number
  onSuccess?: () => void
}

export function StockManagementModal ({
  open,
  onOpenChange,
  productId,
  productName,
  costPriceCents,
  initialStock = 0,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [type, setType] = useState<'entry' | 'exit' | 'loss' | 'balance'>('entry')
  const [quantity, setQuantity] = useState('1')
  const [unitValue, setUnitValue] = useState('')

  const fetchStock = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/portal/produtos/${productId}/estoque`)
      if (res.ok) {
        const json = await res.json()
        setData({ currentStock: json.currentStock ?? 0, movements: json.movements ?? [] })
      } else {
        setData({ currentStock: initialStock, movements: [] })
      }
    } catch {
      setData({ currentStock: initialStock, movements: [] })
    } finally {
      setLoading(false)
    }
  }, [productId, initialStock])

  useEffect(() => {
    if (open && productId) {
      fetchStock()
    }
  }, [open, productId, fetchStock])

  useEffect(() => {
    const defaultCents = typeof costPriceCents === 'number' ? costPriceCents : 0
    if (open && defaultCents > 0 && unitValue === '') {
      setUnitValue((defaultCents / 100).toFixed(2))
    }
  }, [open, costPriceCents, unitValue])

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    const qty = Number(quantity.replace(',', '.'))
    if (!Number.isFinite(qty)) return
    if (type !== 'balance' && qty <= 0) return
    if (type === 'balance' && qty < 0) return
    const uv = Number(String(unitValue || '0').replace(',', '.'))
    const unitValueCents = uv > 0 ? Math.round(uv * 100) : 0

    setSubmitting(true)
    try {
      const res = await fetch(`/api/portal/produtos/${productId}/estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: qty, unitValueCents }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json?.blingPushError) {
          toast({
            variant: 'destructive',
            title: 'Erro ao atualizar estoque no Bling',
            description: json.blingPushError,
          })
        }
        setData((prev) => ({
          currentStock: json.currentStock ?? prev?.currentStock ?? 0,
          movements: prev?.movements ?? [],
        }))
        setQuantity('1')
        await fetchStock()
        onSuccess?.()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const currentStock = data?.currentStock ?? initialStock
  const movements = data?.movements ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestão de estoque</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-normal">
            {productName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm">
            Estoque atual: <span className="font-semibold tabular-nums">{currentStock}</span> unidade(s)
          </p>

          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Registrar movimento</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="modal-type">Tipo</Label>
                <select
                  id="modal-type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={type}
                    onChange={(e) => setType(e.target.value as 'entry' | 'exit' | 'loss' | 'balance')}
                >
                  <option value="entry">Entrada</option>
                  <option value="exit">Saída</option>
                  <option value="loss">Perda</option>
                    <option value="balance">Balanço</option>
                </select>
              </div>
              <div className="space-y-1">
                  <Label htmlFor="modal-quantity">{type === 'balance' ? 'Saldo final' : 'Quantidade'}</Label>
                <Input
                  id="modal-quantity"
                  type="number"
                    min={type === 'balance' ? 0 : 1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modal-unitValue">Valor unit. (R$)</Label>
                <Input
                  id="modal-unitValue"
                  type="number"
                  step="0.01"
                  min={0}
                  value={unitValue}
                  onChange={(e) => setUnitValue(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar movimento'}
            </Button>
          </form>

          <div>
            <p className="text-sm font-medium mb-2">Histórico recente</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum movimento registrado.</p>
            ) : (
              <div className="overflow-x-auto max-h-48 overflow-y-auto rounded border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                      <th className="py-2 pr-2 text-left font-medium">Data</th>
                      <th className="py-2 px-2 text-left font-medium">Tipo</th>
                      <th className="py-2 px-2 text-right font-medium">Qtd</th>
                      <th className="py-2 px-2 text-right font-medium">Total</th>
                      <th className="py-2 pl-2 text-left font-medium">Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.slice(0, 20).map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          {m.createdAt
                            ? new Date(m.createdAt).toLocaleString('pt-BR')
                            : '-'}
                        </td>
                        <td className="py-2 px-2">
                          {m.type === 'entry' ? 'Entrada' : m.type === 'exit' ? 'Saída' : 'Perda'}
                        </td>
                        <td className="py-2 px-2 text-right">{m.quantity}</td>
                        <td className="py-2 px-2 text-right">
                          {m.totalValueCents ? formatCurrency(m.totalValueCents / 100) : '-'}
                        </td>
                        <td className="py-2 pl-2 text-muted-foreground">
                          {m.source === 'bling'
                            ? 'Bling'
                            : m.source === 'system'
                              ? 'Sistema'
                              : 'Portal'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
