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

const ENTRY_CHECK_ITEMS: { key: string; label: string; requiresOn?: boolean }[] = [
  { key: 'rear_camera_main', label: 'Câmera traseira (1x)', requiresOn: true },
  { key: 'rear_camera_2x', label: 'Câmera traseira (2x)', requiresOn: true },
  { key: 'rear_camera_3x', label: 'Câmera traseira (3x)', requiresOn: true },
  { key: 'front_camera', label: 'Câmera frontal', requiresOn: true },
  { key: 'microphone', label: 'Microfone', requiresOn: true },
  { key: 'earpiece_speaker', label: 'Alto-falante de ouvido', requiresOn: true },
  { key: 'loudspeaker', label: 'Alto-falante principal', requiresOn: true },
  { key: 'charging_port', label: 'Carregamento (cabo)', requiresOn: true },
  { key: 'wireless_charging', label: 'Carregamento por indução', requiresOn: true },
  { key: 'sim_signal', label: 'Sinal de operadora', requiresOn: true },
  { key: 'wifi', label: 'Wi‑Fi', requiresOn: true },
  { key: 'bluetooth', label: 'Bluetooth', requiresOn: true },
  { key: 'face_touch_id', label: 'Face ID / Touch ID', requiresOn: true },
  { key: 'volume_buttons', label: 'Botões de volume', requiresOn: true },
  { key: 'power_button', label: 'Botão power', requiresOn: true },
  { key: 'vibration', label: 'Vibração', requiresOn: true },
  { key: 'proximity_sensor', label: 'Sensor de proximidade', requiresOn: true },
  { key: 'display_touch', label: 'Toque na tela', requiresOn: true },
  { key: 'display_colors', label: 'Cores/brilho da tela', requiresOn: true },
]

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
}) {
  const { initialValue, disabled = false, formId } = props
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
        name="deviceEntryChecksJson"
        form={formId}
        value={valueJson}
        readOnly
        aria-hidden
      />
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Situação de entrada do aparelho</span>
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
            <DialogTitle>Situação de entrada do aparelho</DialogTitle>
            <DialogDescription>
              Marque os testes realizados no momento da entrada do aparelho na assistência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Estado na entrada</div>
              <RadioGroup
                value={status}
                onValueChange={setStatus}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="operante" id="edit-entry-operante" />
                  <Label htmlFor="edit-entry-operante" className="cursor-pointer">Liga normalmente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="display_apagado" id="edit-entry-display-apagado" />
                  <Label htmlFor="edit-entry-display-apagado" className="cursor-pointer">Display apagado / danificado</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao_liga" id="edit-entry-nao-liga" />
                  <Label htmlFor="edit-entry-nao-liga" className="cursor-pointer">Não liga</Label>
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
