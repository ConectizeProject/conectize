/**
 * Modal reutilizável de criação/edição de produto (mesmo fluxo da gestão de produtos).
 * Preferir este módulo em listagens e telas fora de `/portal/produtos`.
 *
 * Exemplo:
 * ```tsx
 * const productEdit = useProductEditDialog({ onSuccess: refresh })
 * productEdit.open({ id, name, initialEditTab: 'estoque' })
 * return <>{productEdit.dialog}</>
 * ```
 */
export { ProductFormDialog as ProductEditDialog } from './ProductFormDialog'
export {
  useProductEditDialog,
  type ProductEditTab,
  type ProductEditTarget,
  type UseProductEditDialogOptions,
} from './use-product-edit-dialog'
