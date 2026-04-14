/**
 * Termos de garantia da OS (modelo e/ou texto) para impressão e link público.
 */

export function isOrderWarrantyTermsUnset (order: {
	warranty_template_id?: string | null
	warranty_text?: string | null
}): boolean {
	const hasTemplate = Boolean(order.warranty_template_id)
	const hasText = Boolean(String(order.warranty_text || '').trim())
	return !hasTemplate && !hasText
}
