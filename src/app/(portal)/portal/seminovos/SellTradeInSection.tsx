'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'

export type SellTradeInLine = {
  rowKey: string
  deviceName: string
  imei: string
  info: string
  condition: string
  valueCents: number | null
}

function makeRowKey (): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `trade-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function newEmptySellTradeInLine (): SellTradeInLine {
  return {
    rowKey: makeRowKey(),
    deviceName: '',
    imei: '',
    info: '',
    condition: '',
    valueCents: null,
  }
}

type SellTradeInSectionProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  lines: SellTradeInLine[]
  onLinesChange: (lines: SellTradeInLine[]) => void
}

export function SellTradeInSection ({
  enabled,
  onEnabledChange,
  lines,
  onLinesChange,
}: SellTradeInSectionProps) {
  function updateLine (rowKey: string, patch: Partial<SellTradeInLine>) {
    onLinesChange(lines.map((l) => (l.rowKey === rowKey ? { ...l, ...patch } : l)))
  }

  function addLine () {
    onLinesChange([...lines, newEmptySellTradeInLine()])
  }

  function removeLine (rowKey: string) {
    const next = lines.filter((l) => l.rowKey !== rowKey)
    onLinesChange(next.length > 0 ? next : [newEmptySellTradeInLine()])
  }

  function handleEnableChange (on: boolean) {
    onEnabledChange(on)
    if (on && lines.length === 0) {
      onLinesChange([newEmptySellTradeInLine()])
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-start space-x-2">
        <Checkbox
          id="sell-trade-in"
          className="mt-0.5"
          checked={enabled}
          onCheckedChange={(v) => handleEnableChange(v === true)}
        />
        <Label
          htmlFor="sell-trade-in"
          className="font-normal cursor-pointer leading-snug"
        >
          Incluir aparelho(s) na troca
        </Label>
      </div>
      {enabled ? (
        <div className="space-y-3 border-t pt-3">
          {lines.map((line) => (
            <div
              key={line.rowKey}
              className="grid gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2"
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Aparelho</Label>
                <Input
                  value={line.deviceName}
                  onChange={(e) => updateLine(line.rowKey, { deviceName: e.target.value })}
                  placeholder="Ex: iPhone 13 128GB"
                />
              </div>
              <div className="space-y-1.5">
                <Label>IMEI</Label>
                <Input
                  value={line.imei}
                  onChange={(e) => updateLine(line.rowKey, { imei: e.target.value })}
                  placeholder="IMEI"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={line.condition}
                  onChange={(e) => updateLine(line.rowKey, { condition: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option value="A+">A+</option>
                  <option value="A">A</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B">B</option>
                  <option value="B-">B-</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Informação</Label>
                <Input
                  value={line.info}
                  onChange={(e) => updateLine(line.rowKey, { info: e.target.value })}
                  placeholder="Observações gerais"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  value={line.valueCents != null ? maskedFromCents(line.valueCents) : ''}
                  onChange={(e) => {
                    const raw = moneyToCentsFromMasked(formatMoneyInput(e.target.value))
                    updateLine(line.rowKey, { valueCents: raw })
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                  onClick={() => removeLine(line.rowKey)}
                  disabled={lines.length <= 1}
                  aria-label="Remover aparelho da troca"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar aparelho
          </Button>
        </div>
      ) : null}
    </div>
  )
}
