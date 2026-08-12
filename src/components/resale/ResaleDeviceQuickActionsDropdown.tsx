'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DollarSign, MoreHorizontal, Pencil, Trash2, Wallet } from 'lucide-react'

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
  /** Ações exclusivas de administrador. */
  isAdmin?: boolean
  deviceSold?: boolean
  onEdit?: () => void
  onMarkSold?: () => void
  onAddCost?: () => void
  onDelete?: () => void
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
  isAdmin = false,
  deviceSold = false,
  onEdit,
  onMarkSold,
  onAddCost,
  onDelete,
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
        {isAdmin ? (
          <>
            {onEdit ? (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </DropdownMenuItem>
            ) : null}
            {!deviceSold && onMarkSold ? (
              <DropdownMenuItem onClick={onMarkSold}>
                <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                Vendido
              </DropdownMenuItem>
            ) : null}
            {onAddCost ? (
              <DropdownMenuItem onClick={onAddCost}>
                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                Adicionar custo
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <ResaleDeviceStandardActionItems
          device={device}
          includeSimulate={includeSimulate && !deviceSold}
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
