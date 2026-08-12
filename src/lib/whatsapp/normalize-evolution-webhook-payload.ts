/**
 * Ajusta payload da Evolution (evento na URL, variações de nome de campo).
 */
export function normalizeEvolutionWebhookPayload(
	payload: Record<string, unknown>,
	pathSegments: string[] | undefined,
): Record<string, unknown> {
	const out = { ...payload }

	if (!out.event && pathSegments?.length) {
		const seg = pathSegments[pathSegments.length - 1] || ''
		const ev = seg.replace(/-/g, '.').replace(/_/g, '.').toLowerCase()
		if (ev) out.event = ev
	}

	if (!out.instance) {
		const alt = out.instanceName ?? out.instance_name
		if (typeof alt === 'string' && alt.trim()) out.instance = alt.trim()
	}

	return out
}
