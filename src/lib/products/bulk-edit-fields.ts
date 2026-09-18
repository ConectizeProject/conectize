export type BulkEditGroup = 'sales' | 'fiscal' | 'custom'

export type BulkEditFieldKey =
  | 'costPrice'
  | 'salePrice'
  | 'pricingTagId'
  | 'ncm'
  | 'cest'
  | 'fiscalOrigin'
  | 'fci'
  | 'fiscalUnit'
  | 'compatibleModelIds'
  | 'description'
  | 'isActive'

export type BulkEditFieldOption = {
  id: BulkEditFieldKey
  label: string
  /** Só exibe na lista de produtos (não serviços). */
  productOnly?: boolean
}

export const BULK_EDIT_GROUP_LABELS: Record<BulkEditGroup, string> = {
  sales: 'Dados de venda',
  fiscal: 'Dados fiscais',
  custom: 'Dados customizados',
}

export const BULK_EDIT_FIELDS_BY_GROUP: Record<BulkEditGroup, BulkEditFieldOption[]> = {
  sales: [
    { id: 'costPrice', label: 'Preço de custo' },
    { id: 'salePrice', label: 'Preço de venda' },
    { id: 'pricingTagId', label: 'Tag de precificação' },
  ],
  fiscal: [
    { id: 'ncm', label: 'NCM' },
    { id: 'cest', label: 'CEST' },
    { id: 'fiscalOrigin', label: 'Origem' },
    { id: 'fci', label: 'FCI' },
    { id: 'fiscalUnit', label: 'Unidade' },
  ],
  custom: [
    { id: 'compatibleModelIds', label: 'Modelos compatíveis', productOnly: true },
    { id: 'description', label: 'Descrição' },
    { id: 'isActive', label: 'Ativo' },
  ],
}

export function bulkEditFieldsForGroup (
  group: BulkEditGroup,
  opts?: { allowDeviceModel?: boolean },
): BulkEditFieldOption[] {
  const allowDeviceModel = opts?.allowDeviceModel !== false
  return BULK_EDIT_FIELDS_BY_GROUP[group].filter((opt) => {
    if (opt.productOnly && !allowDeviceModel) return false
    return true
  })
}

export function defaultBulkEditFieldKeys (
  group: BulkEditGroup,
  opts?: { allowDeviceModel?: boolean },
): BulkEditFieldKey[] {
  const available = bulkEditFieldsForGroup(group, opts)
  const ids = new Set(available.map((o) => o.id))

  if (group === 'sales') {
    return (['costPrice', 'salePrice'] as BulkEditFieldKey[]).filter((id) => ids.has(id))
  }
  if (group === 'fiscal') {
    return available.map((o) => o.id)
  }
  const customDefaults: BulkEditFieldKey[] = []
  if (ids.has('compatibleModelIds')) customDefaults.push('compatibleModelIds')
  if (ids.has('description')) customDefaults.push('description')
  return customDefaults
}

export function hasBulkEditField (
  fields: readonly BulkEditFieldKey[],
  key: BulkEditFieldKey,
): boolean {
  return fields.includes(key)
}
