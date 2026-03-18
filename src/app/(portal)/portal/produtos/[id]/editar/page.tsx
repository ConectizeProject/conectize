import { notFound, redirect } from 'next/navigation'
import { getPortalAuth } from '@/lib/supabase/server'
import { ProductForm } from '../../ProductForm'
import { getProductById } from '@/lib/products/service'
import { updateProductAndSyncBling } from '@/lib/products/update-product-with-bling'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function EditarProdutoPage ({ params }: { params: Params }) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')

  const current = await getProductById(id)
  if (!current.ok || !('product' in current)) notFound()

  async function handleUpdate (formData: FormData) {
    'use server'

    const name = String(formData.get('name') || '').trim()
    const sku = String(formData.get('sku') || '').trim() || null
    const barcode = String(formData.get('barcode') || '').trim() || null
    const description = String(formData.get('description') || '').trim() || null
    const salePrice = Number(String(formData.get('salePrice') || '').replace(',', '.')) || 0
    const costPrice = Number(String(formData.get('costPrice') || '').replace(',', '.')) || 0
    const isActive = formData.get('isActive') === 'on'

    await updateProductAndSyncBling(id, {
      name,
      sku,
      barcode,
      description,
      salePriceCents: salePrice > 0 ? Math.round(salePrice * 100) : null,
      costPriceCents: costPrice > 0 ? Math.round(costPrice * 100) : null,
      isActive,
    })

    redirect('/portal/produtos')
  }

  return (
    <ProductForm
      mode="edit"
      product={current.product}
      action={handleUpdate}
    />
  )
}

