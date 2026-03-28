'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ENTRY_CHECK_ITEMS } from '@/lib/orders/entry-check-items'

export type OrderDeviceChecksVariant = 'entry' | 'exit'

const VARIANT_COPY: Record<OrderDeviceChecksVariant, {
  summary: string
  dialogTitle: string
  dialogDesc: string
  stateLabel: string
  hiddenName: string
}> = {
  entry: {
    summary: 'Situação de entrada do aparelho',
    dialogTitle: 'Situação de entrada do aparelho',
    dialogDesc: 'Marque os testes realizados no momento da entrada do aparelho na assistência.',
    stateLabel: 'Estado na entrada',
    hiddenName: 'deviceEntryChecksJson',
  },
  exit: {
    summary: 'Situação de saída do aparelho',
    dialogTitle: 'Situação de saída do aparelho',
    dialogDesc: 'Marque os testes realizados no momento da saída do aparelho (entrega ao cliente), para comparar com a entrada.',
    stateLabel: 'Estado na saída',
    hiddenName: 'deviceExitChecksJson',
  },
}

function parseChecks(raw: Record<string, unknown> | null): Record<string, 'ok' | 'fail' | 'na'> {
  const out: Record<string, 'ok' | 'fail' | 'na'> = {}
  if (!raw || typeof raw !== 'object') return out
  Object.entries(raw).forEach(([k, v]) => {
    if (v === true) out[k] = 'ok'
    else if (v === false) out[k] = 'fail'
    else if (v === 'ok' || v === 'fail' || v === 'na') out[k] = v
  })
  return out
}

function initialJson(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify({ status: 'operante', checks: {} })
  const o = value as { status?: string; checks?: Record<string, unknown> }
  const status = typeof o.status === 'string' ? o.status : 'operante'
  const checks = (o.checks && typeof o.checks === 'object') ? o.checks : {}
  return JSON.stringify({ status, checks })
}

export function OrderDeviceEntryChecksEditor (props: {
  initialValue: unknown
  disabled?: boolean
  formId: string
  /** default `entry` — `exit` usa coluna e campo de formulário próprios */
  variant?: OrderDeviceChecksVariant
}) {
  const { initialValue, disabled = false, formId, variant = 'entry' } = props
  const copy = VARIANT_COPY[variant]
  const [valueJson, setValueJson] = useState(() => initialJson(initialValue))
  const [dialogOpen, setDialogOpen] = useState(false)
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValueJson(initialJson(initialValue))
  }, [initialValue])

  useEffect(() => {
    if (hiddenInputRef.current) hiddenInputRef.current.value = valueJson
  }, [valueJson])

  const parsed = (() => {
    try {
      return valueJson ? JSON.parse(valueJson) : null
    } catch {
      return null
    }
  })()
  const status: string = parsed?.status || 'operante'
  const checks = parseChecks(parsed?.checks ?? null)

  const setStatus = useCallback((next: string) => {
    setValueJson((prev) => {
      let p: { status: string; checks: Record<string, 'ok' | 'fail' | 'na'> }
      try {
        p = prev ? JSON.parse(prev) : { status: 'operante', checks: {} }
      } catch {
        p = { status: 'operante', checks: {} }
      }
      const nextChecks = next === 'operante' ? { ...p.checks } : {}
      return JSON.stringify({ status: next, checks: nextChecks })
    })
  }, [])

  const setCheck = useCallback((key: string, value: 'ok' | 'fail' | 'na') => {
    setValueJson((prev) => {
      let p: { status: string; checks: Record<string, 'ok' | 'fail' | 'na'> }
      try {
        p = prev ? JSON.parse(prev) : { status: 'operante', checks: {} }
      } catch {
        p = { status: 'operante', checks: {} }
      }
      const nextChecks = { ...p.checks, [key]: value }
      return JSON.stringify({ status: p.status, checks: nextChecks })
    })
  }, [])

  const requiresDeviceOn = status === 'operante'

  const notTested = status !== 'operante'
  const passed = Object.values(checks).filter((v) => v === 'ok').length
  const failed = Object.values(checks).filter((v) => v === 'fail').length
  const naCount = Object.values(checks).filter((v) => v === 'na').length

  return (
    <>
      <input
        ref={hiddenInputRef}
        type="hidden"
        name={copy.hiddenName}
        form={formId}
        value={valueJson}
        readOnly
        aria-hidden
      />
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{copy.summary}</span>
          <div className="flex flex-wrap items-center gap-2">
            {notTested ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">Não foi possível testar</span>
            ) : (
              <>
                {passed > 0 && <span className="text-xs text-emerald-600 dark:text-emerald-400">{passed} passaram</span>}
                {failed > 0 && <span className="text-xs text-destructive">{failed} não passaram</span>}
                {naCount > 0 && <span className="text-xs text-muted-foreground">{naCount} não se aplicam</span>}
                {passed === 0 && failed === 0 && naCount === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhum teste registrado</span>
                )}
              </>
            )}
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                Abrir checklist
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.dialogTitle}</DialogTitle>
            <DialogDescription>
              {copy.dialogDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">{copy.stateLabel}</div>
              <RadioGroup
                value={status}
                onValueChange={setStatus}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="operante" id={`edit-${variant}-operante`} />
                  <Label htmlFor={`edit-${variant}-operante`} className="cursor-pointer">Liga normalmente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="display_apagado" id={`edit-${variant}-display-apagado`} />
                  <Label htmlFor={`edit-${variant}-display-apagado`} className="cursor-pointer">Display apagado / danificado</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao_liga" id={`edit-${variant}-nao-liga`} />
                  <Label htmlFor={`edit-${variant}-nao-liga`} className="cursor-pointer">Não liga</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Testes realizados — ✓ funciona · ✗ não funciona · — não se aplica</div>
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-auto pr-1">
                {ENTRY_CHECK_ITEMS.map((item) => {
                  const disabledItem = item.requiresOn && !requiresDeviceOn
                  const current = checks[item.key]
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
                        disabledItem ? 'opacity-50 bg-muted/60 border-muted' : 'bg-background'
                      )}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title="Funciona"
                          disabled={disabledItem}
                          onClick={() => !disabledItem && setCheck(item.key, 'ok')}
                          className={cn(
                            'rounded p-1 transition-colors',
                            disabledItem ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
                            current === 'ok' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'text-muted-foreground'
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Não funciona"
                          disabled={disabledItem}
                          onClick={() => !disabledItem && setCheck(item.key, 'fail')}
                          className={cn(
                            'rounded p-1 transition-colors',
                            disabledItem ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-destructive/10',
                            current === 'fail' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground'
                          )}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Não se aplica"
                          disabled={disabledItem}
                          onClick={() => !disabledItem && setCheck(item.key, 'na')}
                          className={cn(
                            'rounded p-1 transition-colors',
                            disabledItem ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-muted',
                            current === 'na' ? 'bg-muted text-muted-foreground' : 'text-muted-foreground'
                          )}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
