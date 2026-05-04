'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Calculator, Copy, Store, Tag, UserRound } from 'lucide-react'

type DeviceWithImei = {
  imei?: string | null
}

type Props = {
  device: DeviceWithImei
  /** Quando false, oculta “Simular” (ex.: card de vendidos). Default: true */
  includeSimulate?: boolean
  /** Obrigatório quando `includeSimulate` é true */
  onSimulate?: () => void
  onPrintLabel: () => void
  onCopyLojista: () => void
  onCopyCliente: () => void
  onCopyImei: () => void
}

export function ResaleDeviceStandardActionItems ({
  device,
  includeSimulate = true,
  onSimulate,
  onPrintLabel,
  onCopyLojista,
  onCopyCliente,
  onCopyImei,
}: Props) {
  const hasImei = Boolean(String(device.imei ?? '').trim())

  return (
    <>
      {includeSimulate && onSimulate ? (
        <DropdownMenuItem onClick={onSimulate}>
          <Calculator className="h-3.5 w-3.5 mr-1.5" />
          Simular
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onClick={onPrintLabel}>
        <Tag className="h-3.5 w-3.5 mr-1.5" />
        Imprimir etiqueta
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCopyLojista}>
        <Store className="h-3.5 w-3.5 mr-1.5" />
        Copiar dados para lojista
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCopyCliente}>
        <UserRound className="h-3.5 w-3.5 mr-1.5" />
        Copiar dados para cliente
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCopyImei} disabled={!hasImei}>
        <Copy className="h-3.5 w-3.5 mr-1.5" />
        Copiar IMEI
      </DropdownMenuItem>
    </>
  )
}
