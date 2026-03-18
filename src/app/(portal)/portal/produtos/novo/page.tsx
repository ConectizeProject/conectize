import { redirect } from 'next/navigation'
import { getPortalAuth } from '@/lib/supabase/server'
import { ProductForm } from '../ProductForm'
import { createProduct } from '@/lib/products/service'

export const dynamic = 'force-dynamic'

export default async function NovoProdutoPage () {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')

  async function handleCreate (formData: FormData) {
    'use server'

    const name = String(formData.get('name') || '').trim()
    const sku = String(formData.get('sku') || '').trim() || null
    const barcode = String(formData.get('barcode') || '').trim() || null
    const description = String(formData.get('description') || '').trim() || null
    const salePrice = Number(String(formData.get('salePrice') || '').replace(',', '.')) || 0
    const costPrice = Number(String(formData.get('costPrice') || '').replace(',', '.')) || 0
    const isActive = formData.get('isActive') === 'on'
    const initialStock = Number(String(formData.get('initialStock') || '0').replace(',', '.')) || 0

    const created = await createProduct({
      name,
      sku,
      barcode,
      description,
      salePriceCents: salePrice > 0 ? Math.round(salePrice * 100) : null,
      costPriceCents: costPrice > 0 ? Math.round(costPrice * 100) : null,
      isActive,
    })

    if (!created.ok || !('product' in created)) {
      redirect('/portal/produtos')
    }

    if (initialStock > 0) {
      const { addStockMovement } = await import('@/lib/products/service')
      await addStockMovement(created.product.id, {
        type: 'entry',
        quantity: initialStock,
        unitValueCents: created.product.costPriceCents ?? created.product.salePriceCents ?? 0,
        source: 'system',
      })
    }

    redirect('/portal/produtos')
  }

  return (
    <ProductForm
      mode="create"
      action={handleCreate}
    />
  )
}

