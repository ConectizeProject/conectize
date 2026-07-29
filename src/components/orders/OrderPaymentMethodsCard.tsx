'use client'

import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

type Props = {
  defaultValue: PaymentMethodEntry[]
  formId: string
  disabled?: boolean
  cardDescription?: string
  teamUsers?: OrderTeamUserOption[]
  discountCommission?: OrderDiscountCommissionValues
}

export function OrderPaymentMethodsCard({
  defaultValue,
  formId,
  disabled = false,
  cardDescription = 'Como o cliente pode quitar esta ordem de serviço.',
  teamUsers = [],
  discountCommission = EMPTY_ORDER_DISCOUNT_COMMISSION,
}: Props) {
  const fieldsRef = useRef<OrderPaymentMethodFieldsRef>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [discountCents, setDiscountCents] = useState(0)
  const handleDiscountCentsChange = useCallback((cents: number) => {
    setDiscountCents(cents)
  }, [])

  return (
    <Card>
      <CardHeader className="p-5">
        <CardTitle>Formas de pagamento</CardTitle>
        <CardDescription>{cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        <OrderPaymentMethodFields
          ref={fieldsRef}
          defaultValue={defaultValue}
          formId={formId}
          disabled={disabled}
          discountCents={discountCents}
          onCatalogLoadingChange={setCatalogLoading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-dashed border-green-600 bg-green-600/5 text-green-700 hover:bg-green-600/10 hover:text-green-800"
          onClick={() => fieldsRef.current?.addEntry()}
          disabled={disabled || catalogLoading}
          aria-label="Incluir forma de pagamento"
        >
          <Plus className="h-4 w-4 mr-2" />
          Incluir forma de pagamento
        </Button>
        <OrderPaymentDiscountCommissionFields
          defaultValue={discountCommission}
          formId={formId}
          disabled={disabled}
          teamUsers={teamUsers}
          onDiscountCentsChange={handleDiscountCentsChange}
        />
      </CardContent>
    </Card>
  )
}
