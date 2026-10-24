/**
 * Corrige unit_cost_cents nas vendas dos SKUs "Cordao Basic*" para R$ 4,00 (400 centavos).
 * Tambem alinha cost_price_cents no cadastro do produto.
 *
 * Uso: node --env-file=.env.local scripts/fix-cordao-basic-sale-costs.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'

const TARGET_COST_CENTS = 400
const apply = process.argv.includes('--apply')

function money (cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function isCordaoBasicSku (skuRaw) {
  const sku = String(skuRaw || '').trim().toLowerCase()
  return sku === 'cordao basic' || sku.startsWith('cordao basic ')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: products, error: productsError } = await supabase
  .from('products')
  .select('id, organization_id, sku, name, cost_price_cents, is_active')
  .ilike('sku', 'Cordao Basic%')
  .order('sku', { ascending: true })

if (productsError) {
  console.error('products query failed:', productsError.message)
  process.exit(1)
}

const rows = (products ?? []).filter((product) => isCordaoBasicSku(product.sku))
if (rows.length === 0) {
  console.log('Nenhum produto Cordao Basic encontrado')
  process.exit(0)
}

console.log(`Produtos encontrados: ${rows.length}`)
console.log(apply ? 'MODO APPLY: vai gravar custos' : 'DRY-RUN: use --apply para gravar')
console.log('')

let totalItemsChecked = 0
let totalItemsToFix = 0
let totalItemsUpdated = 0
let totalProductsToFix = 0
let totalProductsUpdated = 0

for (const product of rows) {
  const catalog = Number(product.cost_price_cents) || 0
  const needsCatalogFix = catalog !== TARGET_COST_CENTS
  if (needsCatalogFix) totalProductsToFix += 1

  const { data: items, error: itemsError } = await supabase
    .from('sales_order_items')
    .select('id, quantity, unit_cost_cents, sales_order_id, created_at')
    .eq('organization_id', product.organization_id)
    .eq('product_id', product.id)

  if (itemsError) {
    console.error(`itens falhou (${product.sku}):`, itemsError.message)
    continue
  }

  const saleItems = items ?? []
  totalItemsChecked += saleItems.length
  const mismatched = saleItems.filter((item) => Number(item.unit_cost_cents) !== TARGET_COST_CENTS)
  totalItemsToFix += mismatched.length

  console.log(
    [
      product.is_active ? 'ATIVO' : 'inativo',
      product.sku,
      `alvo=${money(TARGET_COST_CENTS)}`,
      `cadastro=${catalog > 0 ? money(catalog) : '—'}`,
      needsCatalogFix ? 'cadastro=corrigir' : 'cadastro=ok',
      `vendas=${saleItems.length}`,
      `corrigir=${mismatched.length}`,
    ].join(' | '),
  )

  if (!apply) continue

  if (needsCatalogFix) {
    const { error: productUpdateError } = await supabase
      .from('products')
      .update({ cost_price_cents: TARGET_COST_CENTS })
      .eq('id', product.id)
      .eq('organization_id', product.organization_id)

    if (productUpdateError) {
      console.error(`  produto falhou (${product.sku}):`, productUpdateError.message)
    } else {
      totalProductsUpdated += 1
    }
  }

  if (mismatched.length === 0) continue

  const ids = mismatched.map((item) => item.id)
  const chunkSize = 200
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data: updated, error: updateError } = await supabase
      .from('sales_order_items')
      .update({ unit_cost_cents: TARGET_COST_CENTS })
      .in('id', chunk)
      .select('id')

    if (updateError) {
      console.error(`  update falhou (${product.sku}):`, updateError.message)
      continue
    }
    totalItemsUpdated += (updated ?? []).length
  }
}

console.log('')
console.log(`Produtos a corrigir no cadastro: ${totalProductsToFix}`)
console.log(`Itens de venda checados: ${totalItemsChecked}`)
console.log(`Itens de venda a corrigir: ${totalItemsToFix}`)
if (apply) {
  console.log(`Produtos atualizados: ${totalProductsUpdated}`)
  console.log(`Itens atualizados: ${totalItemsUpdated}`)
} else {
  console.log('Nada gravado (dry-run). Rode com --apply para aplicar.')
}
