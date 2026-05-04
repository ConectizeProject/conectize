'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

import { ResaleDeviceStandardActionItems } from './ResaleDeviceStandardActionItems'

type DeviceWithImei = {
  imei?: string | null
}

type Props = {
  device: DeviceWithImei
  includeSimulate?: boolean
  onSimulate?: () => void
  onPrintLabel: () => void
  onCopyLojista: () => void
  onCopyCliente: () => void
  onCopyImei: () => void
  triggerClassName?: string
  contentClassName?: string
  align?: 'start' | 'center' | 'end'
}

export function ResaleDeviceQuickActionsDropdown ({
  device,
  includeSimulate = true,
  onSimulate,
  onPrintLabel,
  onCopyLojista,
  onCopyCliente,
  onCopyImei,
  triggerClassName,
  contentClassName,
  align = 'end',
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={triggerClassName ?? 'h-9 w-9 shrink-0 bg-background/95 shadow-md hover:bg-background'}
          aria-label="Ações"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={contentClassName}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ResaleDeviceStandardActionItems
          device={device}
          includeSimulate={includeSimulate}
          onSimulate={onSimulate}
          onPrintLabel={onPrintLabel}
          onCopyLojista={onCopyLojista}
          onCopyCliente={onCopyCliente}
          onCopyImei={onCopyImei}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
