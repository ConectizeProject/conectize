/** Referência única por item — evita estoque duplicado em retry após falha parcial. */
export function inboundNfeItemStockExternalReference (opts: {
  accessKey: string | null | undefined
  documentId: string
  itemId: string
}): string {
  const accessKey = String(opts.accessKey || '').trim()
  const base = accessKey
    ? `nfe:${accessKey}`
    : `nfe_entrada:${opts.documentId}`
  return `${base}:item:${opts.itemId}`
}

/** Extrai a chave de acesso de `nfe:{chave}` ou `nfe:{chave}:item:{id}`. */
export function parseInboundNfeAccessKeyFromStockRef (ref: string): string {
  const raw = String(ref || '').trim()
  if (!raw.startsWith('nfe:')) return ''
  const rest = raw.slice(4)
  const itemIdx = rest.indexOf(':item:')
  return itemIdx >= 0 ? rest.slice(0, itemIdx) : rest
}
