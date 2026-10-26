'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type VendasFilterUser = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

export type VendasFilterMethod = {
  id: string
  description: string
}

function teamUserLabel (user: VendasFilterUser) {
  return String(user.full_name || user.email || 'Usuário').trim()
}

export function VendasListFilters ({
  idPrefix,
  from,
  to,
  sellerUserId,
  paymentMethodId,
  marketplaceOrder,
  teamUsers,
  paymentMethods,
  isLoading,
  canClear,
  onFromChange,
  onToChange,
  onSellerChange,
  onPaymentChange,
  onMarketplaceOrderChange,
  onApply,
  onClear,
}: {
  idPrefix: string
  from: string
  to: string
  sellerUserId: string
  paymentMethodId: string
  marketplaceOrder: string
  teamUsers: VendasFilterUser[]
  paymentMethods: VendasFilterMethod[]
  isLoading: boolean
  canClear: boolean
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onSellerChange: (value: string) => void
  onPaymentChange: (value: string) => void
  onMarketplaceOrderChange: (value: string) => void
  onApply: () => void
  onClear: () => void
}) {
  return (
    <Card className='lg:w-72 lg:shrink-0'>
      <CardHeader className='pb-3'>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3'>
        <div className='space-y-1.5'>
          <Label htmlFor={`${idPrefix}-from`}>Data inicial</Label>
          <Input
            id={`${idPrefix}-from`}
            type='date'
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor={`${idPrefix}-to`}>Data final</Label>
          <Input
            id={`${idPrefix}-to`}
            type='date'
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor={`${idPrefix}-marketplace`}>Pedido no marketplace</Label>
          <Input
            id={`${idPrefix}-marketplace`}
            inputMode='numeric'
            value={marketplaceOrder}
            placeholder='Número do Mercado Livre'
            onChange={(event) => onMarketplaceOrderChange(event.target.value)}
          />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor={`${idPrefix}-seller`}>Vendedor</Label>
          <select
            id={`${idPrefix}-seller`}
            className='h-10 w-full rounded-md border border-input bg-background px-3 text-sm'
            value={sellerUserId}
            onChange={(event) => onSellerChange(event.target.value)}
          >
            <option value=''>Todos os vendedores</option>
            {teamUsers.map((user) => (
              <option key={user.id} value={user.id}>{teamUserLabel(user)}</option>
            ))}
          </select>
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor={`${idPrefix}-payment`}>Método de pagamento</Label>
          <select
            id={`${idPrefix}-payment`}
            className='h-10 w-full rounded-md border border-input bg-background px-3 text-sm'
            value={paymentMethodId}
            onChange={(event) => onPaymentChange(event.target.value)}
          >
            <option value=''>Todos os métodos</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>{method.description}</option>
            ))}
          </select>
        </div>
        <div className='grid gap-2 pt-1'>
          <Button type='button' onClick={onApply} disabled={isLoading}>
            {isLoading ? 'Carregando...' : 'Aplicar'}
          </Button>
          <Button type='button' variant='outline' onClick={onClear} disabled={isLoading || !canClear}>
            Limpar filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
