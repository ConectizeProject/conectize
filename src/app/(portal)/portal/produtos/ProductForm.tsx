'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

type ProductFormProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  salePriceCents: number | null
  costPriceCents: number | null
  isActive: boolean
}

type Props = {
  mode: 'create' | 'edit'
  product?: ProductFormProduct
  action: (formData: FormData) => Promise<void>
}

export function ProductForm ({ mode, product, action }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleSubmit (event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setPending(true)
    try {
      await action(formData)
    } finally {
      setPending(false)
    }
  }

  const title = mode === 'create' ? 'Novo produto/serviço' : 'Editar produto/serviço'

  return (
    <div className="max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" type="button" onClick={() => router.back()}>
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={product?.name || ''}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  name="sku"
                  defaultValue={product?.sku || ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input
                  id="barcode"
                  name="barcode"
                  defaultValue={product?.barcode || ''}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salePrice">Preço de venda (R$)</Label>
                <Input
                  id="salePrice"
                  name="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={
                    typeof product?.salePriceCents === 'number'
                      ? (product.salePriceCents / 100).toFixed(2)
                      : ''
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">Custo (R$)</Label>
                <Input
                  id="costPrice"
                  name="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={
                    typeof product?.costPriceCents === 'number'
                      ? (product.costPriceCents / 100).toFixed(2)
                      : ''
                  }
                />
              </div>
            </div>

            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="initialStock">Estoque inicial (quantidade)</Label>
                <Input
                  id="initialStock"
                  name="initialStock"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                name="isActive"
                defaultChecked={product ? product.isActive : true}
              />
              <Label htmlFor="isActive">Ativo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/portal/produtos')}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

