'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreateCustomerDialog, type CustomerHit } from '@/components/customers'

export function NovoClienteClient() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <CreateCustomerDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) router.replace('/portal/clientes')
      }}
      initialDocumentDigits=""
      mode="create"
      onCreated={(customer: CustomerHit) => {
        router.replace(`/portal/clientes?document=${customer.cnpj || customer.cpf || ''}`)
      }}
    />
  )
}

