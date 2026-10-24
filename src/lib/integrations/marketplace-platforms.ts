import type { SupabaseClient } from '@supabase/supabase-js'
import { MELI_PLATFORM_ID } from '@/lib/integrations/mercado-livre/constants'

/**
 * Plataformas de marketplace com envio/etiqueta (MELI hoje; Shopee/Amazon no futuro).
 * Usado para exibir o board de envios na tela de vendas.
 */
export const MARKETPLACE_SHIPPING_PLATFORM_IDS = [
  MELI_PLATFORM_ID,
  'shopee',
  'amazon',
] as const

export async function hasMarketplaceHubConnection (
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('hub_connections')
    .select('id')
    .in('platform_id', [...MARKETPLACE_SHIPPING_PLATFORM_IDS])
    .limit(1)
    .maybeSingle()

  if (error) return false
  return Boolean(data?.id)
}
