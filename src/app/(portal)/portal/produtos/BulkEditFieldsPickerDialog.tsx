'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import {
  BULK_EDIT_GROUP_LABELS,
  bulkEditFieldsForGroup,
  defaultBulkEditFieldKeys,
  type BulkEditFieldKey,
  type BulkEditGroup,
} from '@/lib/products/bulk-edit-fields'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: BulkEditGroup | null
  allowDeviceModel: boolean
  selectedCount: number
  onConfirm: (fields: BulkEditFieldKey[]) => void
}

export function BulkEditFieldsPickerDialog ({
  open,
  onOpenChange,
  group,
  allowDeviceModel,
  selectedCount,
  onConfirm,
}: Props) {
  const options = useMemo(
    () => (group ? bulkEditFieldsForGroup(group, { allowDeviceModel }) : []),
    [group, allowDeviceModel],
  )

  const [selected, setSelected] = useState<Set<BulkEditFieldKey>>(new Set())

  useEffect(() => {
    if (!open || !group) return
    setSelected(new Set(defaultBulkEditFieldKeys(group, { allowDeviceModel })))
  }, [open, group, allowDeviceModel])

  function toggle (id: BulkEditFieldKey, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function setAll (checked: boolean) {
    setSelected(checked ? new Set(options.map((o) => o.id)) : new Set())
  }

  function handleContinue () {
    const fields = options.map((o) => o.id).filter((id) => selected.has(id))
    if (fields.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione ao menos um campo',
      })
      return
    }
    onConfirm(fields)
  }

  const title = group
    ? `Editar em massa — ${BULK_EDIT_GROUP_LABELS[group]}`
    : 'Editar em massa'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Escolha quais campos editar nos {selectedCount} item
            {selectedCount === 1 ? '' : 's'} selecionado
            {selectedCount === 1 ? '' : 's'}. Depois você ajusta os valores na tabela.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 py-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setAll(true)}
          >
            Marcar todos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setAll(false)}
          >
            Desmarcar todos
          </Button>
        </div>
        <div className="grid gap-3 py-2">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-3">
              <Checkbox
                id={`bulk-field-${opt.id}`}
                checked={selected.has(opt.id)}
                onCheckedChange={(checked) => toggle(opt.id, checked === true)}
              />
              <Label htmlFor={`bulk-field-${opt.id}`} className="text-sm font-normal leading-tight">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleContinue}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
