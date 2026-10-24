/**
 * Corrige unit_cost_cents nas vendas dos SKUs *TMDADPTMKB*
 * para multiplos de R$ 5,80 (580 centavos).
 *
 * Uso: node --env-file=.env.local scripts/fix-tmdadptmkb-sale-costs.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'

const BASE_COST_CENTS = 580
const SKU_NEEDLE = 'TMDADPTMKB'
const apply = process.argv.includes('--apply')

function parseMultiplier (skuRaw) {
  const sku = String(skuRaw || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!sku.includes(SKU_NEEDLE)) return null

  // 2XTMDADPTMKB | 10XTMDADPTMKB | 100XTMDADPTMKB
  const prefix = sku.match(/^(\d+)X/)
  if (prefix) return Math.max(1, Number(prefix[1]) || 1)

  // TMDADPTMKB-04X | TMDADPTMKB-10X | TMDADPTMKB-2X
  const suffix = sku.match(/-(\d+)X$/)
  if (suffix) return Math.max(1, Number(suffix[1]) || 1)

  // SKU unitario TMDADPTMKB
  if (sku === SKU_NEEDLE) return 1

  // Fallback: texto "KIT 2 X ..." etc. no proprio sku
  const kit = sku.match(/(\d+)X/)
  if (kit) return Math.max(1, Number(kit[1]) || 1)

  return 1
}

function money (cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  .ilike('sku', `%${SKU_NEEDLE}%`)
  .order('sku', { ascending: true })

if (productsError) {
  console.error('products query failed:', productsError.message)
  process.exit(1)
}

const rows = products ?? []
if (rows.length === 0) {
  console.log('Nenhum produto com SKU contendo', SKU_NEEDLE)
  process.exit(0)
}

console.log(`Produtos encontrados: ${rows.length}`)
console.log(apply ? 'MODO APPLY: vai gravar unit_cost_cents' : 'DRY-RUN: use --apply para gravar')
console.log('')

let totalItemsChecked = 0
let totalItemsToFix = 0
let totalItemsUpdated = 0

for (const product of rows) {
  const multiplier = parseMultiplier(product.sku)
  if (multiplier == null) continue
  const targetUnitCost = BASE_COST_CENTS * multiplier
  const catalog = Number(product.cost_price_cents) || 0

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
  const mismatched = saleItems.filter((item) => Number(item.unit_cost_cents) !== targetUnitCost)
  totalItemsToFix += mismatched.length

  console.log(
    [
      product.is_active ? 'ATIVO' : 'inativo',
      product.sku,
      `x${multiplier}`,
      `alvo=${money(targetUnitCost)}`,
      `cadastro=${money(catalog)}`,
      `vendas=${saleItems.length}`,
      `corrigir=${mismatched.length}`,
    ].join(' | '),
  )

  if (!apply || mismatched.length === 0) continue

  const ids = mismatched.map((item) => item.id)
  // batch update
  const chunkSize = 200
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data: updated, error: updateError } = await supabase
      .from('sales_order_items')
      .update({ unit_cost_cents: targetUnitCost })
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
console.log(`Itens checados: ${totalItemsChecked}`)
console.log(`Itens a corrigir: ${totalItemsToFix}`)
if (apply) console.log(`Itens atualizados: ${totalItemsUpdated}`)
else console.log('Nada gravado (dry-run). Rode com --apply para aplicar.')
