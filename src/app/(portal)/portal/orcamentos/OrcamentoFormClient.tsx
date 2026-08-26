'use client'

import {
  CreateCustomerDialog,
  EditCustomerDialog,
  type CustomerHit,
} from '@/components/customers'
import {
  OrderServicesCard,
  OrderServicesTotalProvider,
  type OrderServicesCardRef,
  type ServiceLine,
} from '@/components/orders'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { NovaOrdemCustomerCard } from '@/app/(portal)/portal/ordens/nova/NovaOrdemCustomerCard'
import {
  getCustomerDocumentDigits,
  useNovaOrdemCustomerSearch,
} from '@/app/(portal)/portal/ordens/nova/use-nova-ordem-customer-search'
import {
  OrderFormActionBar,
  orderFormActionBarFlowSpacerClassName,
} from '@/app/(portal)/portal/ordens/OrderFormActionBar'
import { parseMoneyToCents } from '@/lib/utils/format-money'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { defaultQuoteValidUntilYmd } from '@/lib/quotes/quote-dates'
import {
  QUOTE_MANUAL_STATUS_VALUES,
  QUOTE_STATUS_LABELS,
} from '@/lib/quotes/quote-status'
import { FieldArray, Form, Formik } from 'formik'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import * as Yup from 'yup'

export type QuoteFormValues = {
  customerId: string
  document: string
  title: string
  status: string
  validUntil: string
  notes: string
  services: ServiceLine[]
}

const schema = Yup.object().shape({
  customerId: Yup.string().required('Selecione um cliente'),
  title: Yup.string().trim().required('Título é obrigatório'),
})

function serializeServicesJson (services: ServiceLine[]): string {
  const servicesNormalized = (services || [])
    .map((s) => {
      const kind = s.kind === 'product' ? 'product' : 'service'
      const description = String(s.description || '').trim()
      const quantityRaw =
        kind === 'product' ? Number.parseInt(String(s.quantity || '1'), 10) : 1
      const quantity =
        Number.isFinite(quantityRaw) && quantityRaw > 0
          ? Math.min(9999, Math.max(1, quantityRaw))
          : 1
      const unitValueCents = parseMoneyToCents(s.value)
      const noCost = s.noCost === true
      const unitCostCents = noCost ? 0 : parseMoneyToCents(s.cost)
      const valueCents = unitValueCents * quantity
      const costCents = unitCostCents * quantity
      const sourceProductId = parseOptionalUuid(s.sourceProductId)
      return {
        kind,
        description,
        quantity,
        unitValueCents,
        unitCostCents,
        valueCents,
        costCents,
        ...(sourceProductId ? { sourceProductId } : {}),
        noCost,
      }
    })
    .filter((s) => s.description || s.valueCents > 0 || s.costCents > 0)

  const totalValueCents = servicesNormalized.reduce((acc, s) => acc + s.valueCents, 0)
  const totalCostCents = servicesNormalized.reduce((acc, s) => acc + s.costCents, 0)
  return JSON.stringify({
    items: servicesNormalized,
    totals: { totalValueCents, totalCostCents },
  })
}

type Props = {
  action: (formData: FormData) => Promise<void>
  initialError?: string
  quoteId?: string
  initialValues?: Partial<QuoteFormValues>
  initialCustomer?: CustomerHit | null
  lockStatus?: boolean
  submitLabel?: string
  heading?: string
}

export function OrcamentoFormClient ({
  action,
  initialError,
  quoteId,
  initialValues,
  initialCustomer = null,
  lockStatus = false,
  submitLabel = 'Salvar orçamento',
  heading = 'Novo orçamento',
}: Props) {
  const servicesCardRef = useRef<OrderServicesCardRef>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(
    initialCustomer,
  )
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<CustomerHit | null>(null)
  const [createCustomerInitialDocumentDigits, setCreateCustomerInitialDocumentDigits] =
    useState('')

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

  const formInitial: QuoteFormValues = {
    customerId: initialValues?.customerId || initialCustomer?.id || '',
    document: initialValues?.document || '',
    title: initialValues?.title || 'Orçamento',
    status: initialValues?.status || 'rascunho',
    validUntil: initialValues?.validUntil || defaultQuoteValidUntilYmd(),
    notes: initialValues?.notes || '',
    services: initialValues?.services || [],
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{heading}</h1>
        {quoteId ? (
          <p className="text-sm text-muted-foreground">
            Ao salvar, a validade é renovada por 7 dias a partir de hoje.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Validade padrão de 7 dias. Sem dados de aparelho — isso fica na OS.
          </p>
        )}
      </div>

      {initialError ? (
        <p className="text-sm text-destructive">{initialError}</p>
      ) : null}

      <Formik
        initialValues={formInitial}
        validationSchema={schema}
        enableReinitialize
        onSubmit={async (values) => {
          servicesCardRef.current?.syncToFormik()
          const fd = new FormData()
          if (quoteId) fd.append('quoteId', quoteId)
          fd.append('customerId', values.customerId)
          fd.append('document', documentDigits)
          fd.append('title', values.title)
          fd.append('status', values.status)
          fd.append('validUntil', values.validUntil)
          fd.append('notes', values.notes)
          fd.append('servicesJson', serializeServicesJson(values.services))
          await action(fd)
        }}
      >
        {(formik) => (
          <>
            <Form className="relative space-y-6">
              <OrderServicesTotalProvider initialTotal={0}>
                <NovaOrdemCustomerCard
                  selectedCustomer={selectedCustomer}
                  searchInput={customerSearchInput}
                  documentDigits={documentDigits}
                  onSearchInputChange={setCustomerSearchInput}
                  isCpfPopoverOpen={isCpfPopoverOpen}
                  onCpfPopoverOpenChange={setIsCpfPopoverOpen}
                  customersFiltered={customersFiltered}
                  isSearchingDocument={isSearchingDocument}
                  documentSearchError={documentSearchError}
                  hasFetched={hasFetched}
                  isDocumentMode={isDocumentMode}
                  isNameMode={isNameMode}
                  onSelectCustomer={(c) => {
                    setSelectedCustomer(c)
                    setIsCpfPopoverOpen(false)
                    formik.setFieldValue('customerId', c.id)
                    formik.setFieldValue('document', getCustomerDocumentDigits(c))
                  }}
                  onClearCustomer={() => {
                    setSelectedCustomer(null)
                    setIsCpfPopoverOpen(true)
                    formik.setFieldValue('customerId', '')
                    formik.setFieldValue('document', documentDigits)
                  }}
                  onEditCustomer={() => {
                    setCustomerToEdit(selectedCustomer!)
                    setIsCreateCustomerOpen(true)
                  }}
                  onCreateCustomer={() => {
                    setCreateCustomerInitialDocumentDigits(documentDigits)
                    setCustomerToEdit(null)
                    setIsCpfPopoverOpen(false)
                    setIsCreateCustomerOpen(true)
                  }}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Dados do orçamento</CardTitle>
                    <CardDescription>Título, status e validade.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        name="title"
                        value={formik.values.title}
                        onChange={formik.handleChange}
                        maxLength={120}
                        disabled={lockStatus}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formik.values.status}
                        onValueChange={(v) => formik.setFieldValue('status', v)}
                        disabled={lockStatus}
                      >
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {formik.values.status === 'convertido' ? (
                            <SelectItem value="convertido">
                              {QUOTE_STATUS_LABELS.convertido}
                            </SelectItem>
                          ) : null}
                          {QUOTE_MANUAL_STATUS_VALUES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {QUOTE_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validUntil">Validade</Label>
                      <Input
                        id="validUntil"
                        name="validUntil"
                        type="date"
                        value={formik.values.validUntil}
                        onChange={formik.handleChange}
                        disabled={Boolean(quoteId)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="notes">Observações</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        value={formik.values.notes}
                        onChange={formik.handleChange}
                        maxLength={4000}
                        rows={3}
                        disabled={lockStatus}
                      />
                    </div>
                  </CardContent>
                </Card>

                <FieldArray name="services">
                  {({ push, remove }) => (
                    <OrderServicesCard
                      ref={servicesCardRef}
                      disabled={lockStatus}
                      formik={{
                        services: formik.values.services ?? [],
                        onAdd: (item) => push(item),
                        onRemove: remove,
                        onUpdate: (idx, field, value) =>
                          formik.setFieldValue(`services.${idx}.${field}`, value),
                        onBlurSync: (services) =>
                          formik.setFieldValue('services', services),
                      }}
                    />
                  )}
                </FieldArray>

                {(formik.touched.customerId || formik.submitCount > 0) &&
                formik.errors.customerId ? (
                  <p className="text-sm text-destructive">{formik.errors.customerId}</p>
                ) : null}

                <div aria-hidden className={orderFormActionBarFlowSpacerClassName} />
                <OrderFormActionBar>
                  <Button
                    variant="ghost"
                    asChild
                    className="font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/portal/orcamentos">Cancelar</Link>
                  </Button>
                  <Button type="submit" disabled={formik.isSubmitting || !selectedCustomer || lockStatus}>
                    {formik.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Salvando…
                      </>
                    ) : (
                      submitLabel
                    )}
                  </Button>
                </OrderFormActionBar>
              </OrderServicesTotalProvider>
            </Form>

            {customerToEdit ? (
              <EditCustomerDialog
                open={isCreateCustomerOpen}
                onOpenChange={setIsCreateCustomerOpen}
                customer={customerToEdit}
                onSaved={(customer) => {
                  setSelectedCustomer(customer)
                  setIsCpfPopoverOpen(false)
                  formik.setFieldValue('customerId', customer.id)
                  formik.setFieldValue('document', getCustomerDocumentDigits(customer))
                }}
              />
            ) : (
              <CreateCustomerDialog
                open={isCreateCustomerOpen}
                onOpenChange={setIsCreateCustomerOpen}
                initialDocumentDigits={createCustomerInitialDocumentDigits}
                mode="create"
                onCreated={(customer) => {
                  setSelectedCustomer(customer)
                  setIsCpfPopoverOpen(false)
                  formik.setFieldValue('customerId', customer.id)
                  formik.setFieldValue('document', getCustomerDocumentDigits(customer))
                }}
              />
            )}
          </>
        )}
      </Formik>
    </div>
  )
}
