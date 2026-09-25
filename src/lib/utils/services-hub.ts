export const SERVICES_HUB_PATH = '/conserto-de-celular-belo-horizonte'

export function buildServicesHubHref(
	input: {
		marca?: string
		servico?: string
		dispositivo?: string
		modelo?: string
		page?: number
	} = {},
) {
	const params = new URLSearchParams()
	if (input.marca) params.set('marca', input.marca)
	if (input.servico) params.set('servico', input.servico)
	if (input.dispositivo) params.set('dispositivo', input.dispositivo)
	if (input.modelo) params.set('modelo', input.modelo)
	if (input.page && input.page > 1) params.set('page', String(input.page))
	const query = params.toString()
	return query ? `${SERVICES_HUB_PATH}?${query}` : SERVICES_HUB_PATH
}
