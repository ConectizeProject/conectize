'use client'

import { useMemo } from 'react'
import { CreateCustomerDialog, type CustomerHit } from './CreateCustomerDialog'
import { onlyDigits } from '@/lib/utils/strings'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: CustomerHit
  onSaved: (customer: CustomerHit) => void
}

/**
 * Modal de edição de cliente reutilizável.
 * O CPF/CNPJ não pode ser alterado na edição.
 * Use em: Resumo do cliente (OS), Listagem de clientes, Nova OS (trocar cliente), etc.
 */
export function EditCustomerDialog({ open, onOpenChange, customer, onSaved }: Props) {
  const initialDocumentDigits = useMemo(
    () => onlyDigits(String(customer.cnpj || customer.cpf || '')).slice(0, 14),
    [customer.cnpj, customer.cpf]
  )

  return (
    <CreateCustomerDialog
      open={open}
      onOpenChange={onOpenChange}
      initialDocumentDigits={initialDocumentDigits}
      mode="edit"
      customer={customer}
      onCreated={onSaved}
    />
  )
}
