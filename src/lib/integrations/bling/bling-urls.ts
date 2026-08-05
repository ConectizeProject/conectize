/**
 * Deep-links do painel web do Bling (pedido de venda e NFC-e).
 * URLs legadas ainda redirecionam no app atual do Bling.
 */

export function blingPedidoVendaUrl (blingPedidoId: string | number): string {
  const id = String(blingPedidoId || '').trim()
  return `https://www.bling.com.br/vendas.php#edit/${encodeURIComponent(id)}`
}

export function blingNfceUrl (blingNfceId: string | number): string {
  const id = String(blingNfceId || '').trim()
  return `https://www.bling.com.br/notas.fiscais.php#edit/${encodeURIComponent(id)}`
}

/** Preferencial: NFC-e se existir; senão o pedido (onde dá para gerar NFC-e). */
export function blingOrderPreferredUrl (input: {
  blingPedidoId?: string | number | null
  blingNfceId?: string | number | null
}): string | null {
  if (input.blingNfceId != null && String(input.blingNfceId).trim()) {
    return blingNfceUrl(input.blingNfceId)
  }
  if (input.blingPedidoId != null && String(input.blingPedidoId).trim()) {
    return blingPedidoVendaUrl(input.blingPedidoId)
  }
  return null
}
