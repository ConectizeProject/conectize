'use client'

import { useState } from 'react'
import { ArrowLeftRight, Check, ChevronsUpDown, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  CreateCustomerDialog,
  EditCustomerDialog,
  type CustomerHit,
} from '@/components/customers'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'
import { fromDbCustomerType } from '@/lib/sales-orders/customer-type'
import { cn } from '@/lib/utils'
import {
  getCustomerDisplayName,
  getCustomerDocumentDigits,
  useNovaOrdemCustomerSearch,
} from '@/app/(portal)/portal/ordens/nova/use-nova-ordem-customer-search'

type Props = {
  editable: boolean
  selectedCustomer: CustomerHit | null
  stateRegistration: string
  stateRegistrationExempt: boolean
  onSelectCustomer: (customer: CustomerHit | null) => void
  onStateRegistrationChange: (value: string) => void
  onStateRegistrationExemptChange: (value: boolean) => void
}

export function NfeDestinatarioCard ({
  editable,
  selectedCustomer,
  stateRegistration,
  stateRegistrationExempt,
  onSelectCustomer,
  onStateRegistrationChange,
  onStateRegistrationExemptChange,
}: Props) {
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false)
  const {
    customerSearchInput,
    setCustomerSearchInput,
    documentDigits,
    isDocumentMode,
    isNameMode,
    isSearchingDocument,
    documentSearchError,
    hasFetched,
    customersFiltered,
    isCpfPopoverOpen,
    setIsCpfPopoverOpen,
  } = useNovaOrdemCustomerSearch({ selectedCustomer })

  const isCompany = selectedCustomer
    ? Boolean(selectedCustomer.is_company) || getCustomerDocumentDigits(selectedCustomer).length === 14
    : false

  function selectCustomer (customer: CustomerHit | null) {
    onSelectCustomer(customer)
    setIsCpfPopoverOpen(false)
  }

  return (
    <>
      {editable ? (
        selectedCustomer ? (
          <div className='space-y-3'>
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                <p className='font-medium break-words'>{getCustomerDisplayName(selectedCustomer)}</p>
                <p className='text-sm text-muted-foreground'>
                  {formatCpfCnpj(getCustomerDocumentDigits(selectedCustomer)) || 'Sem documento'}
                </p>
                <p className='text-sm text-muted-foreground'>
                  {isCompany ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-1'>
                {selectedCustomer.id && !selectedCustomer.id.startsWith('local:') ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    aria-label='Editar cliente'
                    onClick={() => setIsEditCustomerOpen(true)}
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                ) : null}
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  aria-label='Trocar cliente'
                  onClick={() => selectCustomer(null)}
                >
                  <ArrowLeftRight className='h-4 w-4' />
                </Button>
              </div>
            </div>

            {isCompany ? (
              <div className='space-y-2'>
                <div className='flex items-center justify-between gap-3'>
                  <Label htmlFor='nfe-customer-ie'>Inscrição estadual</Label>
                  <label htmlFor='nfe-customer-ie-exempt' className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <input
                      id='nfe-customer-ie-exempt'
                      type='checkbox'
                      checked={stateRegistrationExempt}
                      onChange={(event) => onStateRegistrationExemptChange(event.target.checked)}
                      className='h-3.5 w-3.5'
                    />
                    Isento
                  </label>
                </div>
                <Input
                  id='nfe-customer-ie'
                  value={stateRegistrationExempt ? '' : stateRegistration}
                  onChange={(e) => onStateRegistrationChange(e.target.value)}
                  disabled={stateRegistrationExempt}
                  autoComplete='off'
                  placeholder={stateRegistrationExempt ? 'Isento' : 'IE do destinatário'}
                />
                <p className='text-xs text-muted-foreground'>
                  Entra no XML da NF-e. CNPJ contribuinte precisa da IE cadastrada na SEFAZ.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className='space-y-2'>
            <Label htmlFor='nfeCustomerSearchTrigger'>Buscar cliente</Label>
            <Popover open={isCpfPopoverOpen} onOpenChange={setIsCpfPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  id='nfeCustomerSearchTrigger'
                  type='button'
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm',
                    'transition-colors hover:bg-accent/30',
                  )}
                >
                  <span className={cn(!customerSearchInput ? 'text-muted-foreground' : '')}>
                    {customerSearchInput
                      ? (isDocumentMode ? formatCpfCnpj(documentDigits) : customerSearchInput)
                      : 'Digite o nome ou CPF/CNPJ (mín. 2 letras ou 5 números)'}
                  </span>
                  <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
                </button>
              </PopoverTrigger>
              <PopoverContent className='w-[min(520px,calc(100vw-2rem))] p-0' align='start'>
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder='Nome ou CPF/CNPJ…'
                    value={customerSearchInput}
                    onValueChange={(value) => {
                      if (/[a-zA-Z\u00C0-\u024F]/.test(value)) {
                        setCustomerSearchInput(value)
                        return
                      }
                      setCustomerSearchInput(formatCpfCnpj(value.replace(/\D/g, '')))
                    }}
                  />
                  <CommandList>
                    {customersFiltered.length === 0 ? (
                      <CommandEmpty>
                        {!isDocumentMode && !isNameMode
                          ? 'Digite pelo menos 2 letras (nome) ou 5 números (CPF/CNPJ).'
                          : documentSearchError
                            ? documentSearchError
                            : hasFetched
                              ? 'Nenhum cliente encontrado.'
                              : isSearchingDocument
                                ? 'Buscando…'
                                : 'Aguarde…'}
                      </CommandEmpty>
                    ) : null}
                    {customersFiltered.length > 0 ? (
                      <CommandGroup heading='Clientes'>
                        {customersFiltered.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${getCustomerDisplayName(customer)} ${getCustomerDocumentDigits(customer)}`}
                            onSelect={() => selectCustomer(customer)}
                          >
                            <Check className='mr-2 h-4 w-4 opacity-0' />
                            <div className='flex flex-col'>
                              <span className='font-medium'>{getCustomerDisplayName(customer)}</span>
                              <span className='text-xs text-muted-foreground'>
                                {formatCpfCnpj(getCustomerDocumentDigits(customer))}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : null}
                  </CommandList>
                  <div className='flex items-center justify-end gap-2 border-t p-2'>
                    <Button
                      type='button'
                      size='sm'
                      onClick={() => {
                        setIsCpfPopoverOpen(false)
                        setIsCreateCustomerOpen(true)
                      }}
                    >
                      <Plus className='mr-1 h-4 w-4' />
                      Cadastrar cliente
                    </Button>
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
            <p className='text-xs text-muted-foreground'>
              A NF-e exige destinatário cadastrado com CPF ou CNPJ e endereço completo.
            </p>
          </div>
        )
      ) : (
        <div className='space-y-1 text-sm'>
          <p><strong>Nome:</strong> {selectedCustomer ? getCustomerDisplayName(selectedCustomer) : '—'}</p>
          <p>
            <strong>Documento:</strong>{' '}
            {selectedCustomer ? (formatCpfCnpj(getCustomerDocumentDigits(selectedCustomer)) || '—') : '—'}
          </p>
          {isCompany ? (
            <p>
              <strong>IE:</strong>{' '}
              {stateRegistrationExempt ? 'Isento' : (stateRegistration.trim() || '—')}
            </p>
          ) : null}
        </div>
      )}

      <CreateCustomerDialog
        open={isCreateCustomerOpen}
        onOpenChange={setIsCreateCustomerOpen}
        initialDocumentDigits={documentDigits}
        onCreated={(customer) => {
          selectCustomer(customer)
          setIsCreateCustomerOpen(false)
        }}
      />

      {selectedCustomer && !selectedCustomer.id.startsWith('local:') ? (
        <EditCustomerDialog
          open={isEditCustomerOpen}
          onOpenChange={setIsEditCustomerOpen}
          customer={selectedCustomer}
          onSaved={(customer) => {
            selectCustomer(customer)
            setIsEditCustomerOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

export function nfeCustomerHitFromOrder (order: {
  id: string
  customer_name: string | null
  customer_type: string | null
  customer_document: string | null
  customer_state_registration?: string | null
  customer_state_registration_exempt?: boolean
}): CustomerHit | null {
  const name = String(order.customer_name || '').trim()
  const doc = onlyDigits(String(order.customer_document || ''))
  if (!name && !doc) return null
  if (name.toLowerCase() === 'consumidor final' && !doc) return null

  const isCompany = fromDbCustomerType(order.customer_type) === 'pj' || doc.length === 14
  return {
    id: `local:${order.id}`,
    full_name: isCompany ? null : name || null,
    company_name: isCompany ? name || null : null,
    is_company: isCompany,
    cpf: isCompany ? null : (doc || null),
    cnpj: isCompany ? (doc || null) : null,
    state_registration: order.customer_state_registration || null,
    state_registration_exempt: order.customer_state_registration_exempt === true,
  }
}
