'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DollarSign, History, MoreHorizontal, Pencil, RotateCcw, Trash2, Wallet } from 'lucide-react'

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
  /** Adicionar custo e excluir (somente admin). */
  isAdmin?: boolean
  /** Editar aparelho, marcar/editar/cancelar venda e ver histórico (staff + admin). */
  canManageSale?: boolean
  deviceSold?: boolean
  onEdit?: () => void
  onMarkSold?: () => void
  onEditSale?: () => void
  onCancelSale?: () => void
  onAddCost?: () => void
  onDelete?: () => void
  onViewHistory?: () => void
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
  canManageSale = false,
  deviceSold = false,
  onEdit,
  onMarkSold,
  onEditSale,
  onCancelSale,
  onAddCost,
  onDelete,
  onViewHistory,
  triggerClassName,
  contentClassName,
  align = 'end',
}: Props) {
  const canEditDevice = canManageSale && Boolean(onEdit)
  const hasSaleActions = canManageSale && (
    (!deviceSold && onMarkSold)
    || (deviceSold && onEditSale)
    || (deviceSold && onCancelSale)
    || onViewHistory
  )
  const hasAdminActions = isAdmin && (onAddCost || onDelete)
  const hasManageBlock = canEditDevice || hasSaleActions || hasAdminActions

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
        {hasManageBlock ? (
          <>
            {canEditDevice ? (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </DropdownMenuItem>
            ) : null}
            {canManageSale && !deviceSold && onMarkSold ? (
              <DropdownMenuItem onClick={onMarkSold}>
                <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                Vendido
              </DropdownMenuItem>
            ) : null}
            {canManageSale && deviceSold && onEditSale ? (
              <DropdownMenuItem onClick={onEditSale}>
                <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                Editar venda
              </DropdownMenuItem>
            ) : null}
            {canManageSale && deviceSold && onCancelSale ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onCancelSale}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Cancelar venda
              </DropdownMenuItem>
            ) : null}
            {canManageSale && onViewHistory ? (
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="mr-1.5 h-3.5 w-3.5" />
                Histórico
              </DropdownMenuItem>
            ) : null}
            {isAdmin && onAddCost ? (
              <DropdownMenuItem onClick={onAddCost}>
                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                Adicionar custo
              </DropdownMenuItem>
            ) : null}
            {isAdmin && onDelete ? (
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
