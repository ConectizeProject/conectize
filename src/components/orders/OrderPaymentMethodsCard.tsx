'use client'

import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PortalPaymentMethodCatalogItem } from '@/lib/portal/payment-methods-server'
import {
  OrderPaymentDiscountCommissionFields,
  type OrderTeamUserOption,
} from './OrderPaymentDiscountCommissionFields'
import {
  OrderPaymentMethodFields,
  type OrderPaymentMethodFieldsRef,
  type PaymentMethodEntry,
} from './OrderPaymentMethodFields'
import {
  EMPTY_ORDER_DISCOUNT_COMMISSION,
  type OrderDiscountCommissionValues,
} from '@/lib/orders/order-discount-commission'

type FormikProps = {
  values: { paymentMethods: PaymentMethodEntry[] }
  setFieldValue: (field: string, value: PaymentMethodEntry[]) => void
}

type DiscountCommissionFormik = {
  values: OrderDiscountCommissionValues
  setFieldValue: (field: string, value: unknown) => void
}

type Props = {
  /** Modo form nativo (ex.: edição de OS). */
  defaultValue?: PaymentMethodEntry[]
  formId?: string
  /** Modo Formik (ex.: nova OS). */
  formik?: FormikProps
  /** Modo controlado (ex.: PDV / vendas). */
  value?: PaymentMethodEntry[]
  onChange?: (value: PaymentMethodEntry[]) => void
  disabled?: boolean
  title?: string
  description?: string | null
  /** @deprecated use description */
  cardDescription?: string
  totalValueCents?: number
  initialCatalog?: PortalPaymentMethodCatalogItem[]
  teamUsers?: OrderTeamUserOption[]
  discountCommission?: OrderDiscountCommissionValues
  discountCommissionFormik?: DiscountCommissionFormik
  onDiscountCentsChange?: (cents: number) => void
  showDiscountCommission?: boolean
}

export type { PaymentMethodEntry }

export function OrderPaymentMethodsCard ({
  defaultValue = [],
  formId,
  formik,
  value,
  onChange,
  disabled = false,
  title = 'Formas de pagamento',
  description,
  cardDescription,
  totalValueCents,
  initialCatalog,
  teamUsers = [],
  discountCommission = EMPTY_ORDER_DISCOUNT_COMMISSION,
  discountCommissionFormik,
  onDiscountCentsChange,
  showDiscountCommission,
}: Props) {
  const fieldsRef = useRef<OrderPaymentMethodFieldsRef>(null)
  const [catalogLoading, setCatalogLoading] = useState(initialCatalog === undefined)
  const [discountCents, setDiscountCents] = useState(0)

  const resolvedDescription = description !== undefined
    ? description
    : (cardDescription ?? 'Como o cliente pode quitar esta ordem de serviço.')

  const shouldShowDiscountCommission = showDiscountCommission ?? (
    Boolean(discountCommissionFormik) || teamUsers.length > 0 || Boolean(formId)
  )

  const handleDiscountCentsChange = useCallback((cents: number) => {
    setDiscountCents(cents)
    onDiscountCentsChange?.(cents)
  }, [onDiscountCentsChange])

  const resolvedFormik = formik ?? (
    value && onChange
      ? {
        values: { paymentMethods: value },
        setFieldValue: (_field: string, next: PaymentMethodEntry[]) => onChange(next),
      }
      : undefined
  )

  return (
    <Card>
      <CardHeader className='p-5'>
        <CardTitle>{title}</CardTitle>
        {resolvedDescription ? <CardDescription>{resolvedDescription}</CardDescription> : null}
      </CardHeader>
      <CardContent className='space-y-3 p-5 pt-0'>
        <OrderPaymentMethodFields
          ref={fieldsRef}
          formik={resolvedFormik}
          defaultValue={resolvedFormik ? undefined : defaultValue}
          formId={formId}
          disabled={disabled}
          totalValueCents={totalValueCents}
          discountCents={discountCents}
          initialCatalog={initialCatalog}
          onCatalogLoadingChange={setCatalogLoading}
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='w-full border-dashed border-green-600 bg-green-600/5 text-green-700 hover:bg-green-600/10 hover:text-green-800'
          onClick={() => fieldsRef.current?.addEntry()}
          disabled={disabled || catalogLoading}
          aria-label='Incluir forma de pagamento'
        >
          <Plus className='mr-2 h-4 w-4' />
          Incluir forma de pagamento
        </Button>
        {shouldShowDiscountCommission ? (
          <OrderPaymentDiscountCommissionFields
            formik={discountCommissionFormik}
            defaultValue={discountCommissionFormik ? undefined : discountCommission}
            formId={formId}
            disabled={disabled}
            teamUsers={teamUsers}
            onDiscountCentsChange={handleDiscountCentsChange}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
