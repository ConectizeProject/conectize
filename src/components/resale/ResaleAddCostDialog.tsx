'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatMoneyInput, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'

type Props = {
  deviceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResaleAddCostDialog ({
  deviceId,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [valueMasked, setValueMasked] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  function handleClose () {
    if (isSaving) return
    onOpenChange(false)
    setDescription('')
    setValueMasked('')
  }

  async function handleSave () {
    if (!deviceId || isSaving) return
    const valueCents = moneyToCentsFromMasked(valueMasked)
    if (valueCents == null || valueCents <= 0) {
      toast({
        title: 'Informe um valor válido',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim() || null,
          value_cents: valueCents,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível adicionar o custo',
          description: data?.error || data?.message,
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Custo adicionado' })
      handleClose()
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
        else onOpenChange(true)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar custo</DialogTitle>
          <DialogDescription>
            Informe a descrição e o valor do custo adicional para este aparelho.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='revenda-cost-description'>Descrição</Label>
            <Input
              id='revenda-cost-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Ex: Troca de tela, frete...'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='revenda-cost-value'>Valor (R$)</Label>
            <Input
              id='revenda-cost-value'
              value={valueMasked}
              onChange={(e) => setValueMasked(formatMoneyInput(e.target.value))}
              placeholder='0,00'
              inputMode='numeric'
            />
          </div>
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={() => void handleSave()}
            disabled={isSaving || !valueMasked.trim()}
          >
            {isSaving ? 'Salvando…' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
