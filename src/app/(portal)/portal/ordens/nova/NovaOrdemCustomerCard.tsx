'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, Pencil, ArrowLeftRight, ChevronDown, ChevronUp, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CustomerDataGrid, CustomerOrderHistoryModal } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'
import { cn } from '@/lib/utils'
import type { CustomerHit } from '@/components/customers'

function getCustomerDocumentDigits(c: CustomerHit) {
  return onlyDigits(String(c.cnpj || c.cpf || '')).slice(0, 14)
}

function getCustomerDisplayName(c: CustomerHit) {
  if (c.is_company) return String(c.company_name || c.trade_name || c.full_name || 'Empresa')
  return String(c.full_name || 'Cliente')
}

type Props = {
  selectedCustomer: CustomerHit | null
  searchInput: string
  documentDigits: string
  onSearchInputChange: (v: string) => void
  isCpfPopoverOpen: boolean
  onCpfPopoverOpenChange: (open: boolean) => void
  customersFiltered: CustomerHit[]
  isSearchingDocument: boolean
  documentSearchError: string | null
  hasFetched: boolean
  isDocumentMode: boolean
  isNameMode: boolean
  onSelectCustomer: (c: CustomerHit) => void
  onClearCustomer: () => void
  onEditCustomer: () => void
  onCreateCustomer: () => void
}

export function NovaOrdemCustomerCard({
  selectedCustomer,
  searchInput,
  documentDigits,
  onSearchInputChange,
  isCpfPopoverOpen,
  onCpfPopoverOpenChange,
  customersFiltered,
  isSearchingDocument,
  documentSearchError,
  hasFetched,
  isDocumentMode,
  isNameMode,
  onSelectCustomer,
  onClearCustomer,
  onEditCustomer,
  onCreateCustomer,
}: Props) {
  const [isDataOpen, setIsDataOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  return (
    <>
    <Card>
      {selectedCustomer ? (
        <Collapsible open={isDataOpen} onOpenChange={setIsDataOpen}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">Dados do cliente</CardTitle>
                <CardDescription>
                  {getCustomerDisplayName(selectedCustomer)} • {formatCpfCnpj(getCustomerDocumentDigits(selectedCustomer))}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsHistoryOpen(true)}
                  aria-label="Ver histórico de ordens do cliente"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onEditCustomer}
                  aria-label="Editar cliente"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearCustomer}
                  aria-label="Trocar cliente"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={isDataOpen ? 'Recolher dados do cliente' : 'Exibir dados do cliente'}
                  >
                    {isDataOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <CustomerDataGrid customer={selectedCustomer} />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">Dados do cliente</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          <div className="space-y-2">
            <Label htmlFor="customerSearchTrigger">Buscar cliente</Label>
            <Popover open={isCpfPopoverOpen} onOpenChange={onCpfPopoverOpenChange}>
              <PopoverTrigger asChild>
                <button
                  id="customerSearchTrigger"
                  type="button"
                  className={cn(
                    'w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm',
                    'hover:bg-accent/30 transition-colors'
                  )}
                >
                  <span className={cn(!searchInput ? 'text-muted-foreground' : '')}>
                    {searchInput
                      ? (isDocumentMode ? formatCpfCnpj(documentDigits) : searchInput)
                      : 'Digite o nome ou CPF/CNPJ (mín. 2 letras ou 5 números)'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[min(520px,calc(100vw-2rem))]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Nome ou CPF/CNPJ…"
                    value={searchInput}
                    onValueChange={(v) => {
                      if (/[a-zA-Z\u00C0-\u024F]/.test(v)) {
                        onSearchInputChange(v)
                      } else {
                        onSearchInputChange(formatCpfCnpj(v.replace(/\D/g, '')))
                      }
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
                      <CommandGroup heading="Clientes">
                        {customersFiltered.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${getCustomerDisplayName(c)} ${getCustomerDocumentDigits(c)}`}
                            onSelect={() => onSelectCustomer(c)}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            <div className="flex flex-col">
                              <span className="font-medium">{getCustomerDisplayName(c)}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatCpfCnpj(getCustomerDocumentDigits(c))}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : null}
                  </CommandList>
                  <div className="border-t p-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {isDocumentMode
                        ? (documentDigits.length === 14
                          ? 'CNPJ completo'
                          : documentDigits.length === 11
                            ? 'CPF completo'
                            : 'Digite até completar 11 (CPF) ou 14 (CNPJ) números')
                        : 'Busca por nome, razão social ou nome fantasia'}
                    </div>
                    <Button type="button" size="sm" onClick={onCreateCustomer}>
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar cliente
                    </Button>
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          </CardContent>
        </>
      )}
    </Card>

    {selectedCustomer?.id ? (
      <CustomerOrderHistoryModal
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        customerId={selectedCustomer.id}
        isCreationPage
      />
    ) : null}
    </>
  )
}
