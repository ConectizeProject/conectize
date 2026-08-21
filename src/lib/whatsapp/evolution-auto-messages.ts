export const EVOLUTION_AUTO_MESSAGE_EVENTS = [
	'os_opened',
	'os_ready_for_pickup',
] as const

export type EvolutionAutoMessageEvent =
	(typeof EVOLUTION_AUTO_MESSAGE_EVENTS)[number]

export type EvolutionAutoMessageTemplates = {
	os_opened?: string
	os_ready_for_pickup?: string
}

export const EVOLUTION_AUTO_MESSAGE_MAX_LENGTH = 4000

/** Mesmo formato do botão "Enviar WhatsApp" (`buildOrderMessage`). */
export const DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES: Record<
	EvolutionAutoMessageEvent,
	string
> = {
	os_opened: [
		'Olá {{nome}}, segue abaixo os dados da sua ordem de serviço:',
		'',
		'*Ordem de Serviço #{{os}}*{{empresa_sufixo}}',
		'Título: {{titulo}}',
		'Status: {{status}}',
		'Aparelho: {{aparelho}}',
		'{{previsao_linha}}',
		'',
		'Acesse sua OS: {{link}}',
	].join('\n'),
	os_ready_for_pickup: [
		'Olá {{nome}}, sua ordem de serviço *#{{os}}* está pronta para retirada.',
		'',
		'Título: {{titulo}}',
		'Aparelho: {{aparelho}}',
		'Valor total: {{valor_total}}',
		'',
		'{{empresa}}',
	].join('\n'),
}

export type EvolutionAutoMessageVars = {
	nome: string
	nome_completo: string
	os: string
	titulo: string
	aparelho: string
	status: string
	previsao: string
	/** Linha completa `Previsão: …` ou vazia. */
	previsao_linha: string
	link: string
	empresa: string
	/** Sufixo ` - Empresa` ou vazio (como em buildOrderMessage). */
	empresa_sufixo: string
	/** Total dos serviços/produtos formatado em BRL (ex.: R$ 150,00). */
	valor_total: string
}

const TEMPLATE_VAR_KEYS = new Set<string>([
	'nome',
	'nome_completo',
	'os',
	'titulo',
	'aparelho',
	'status',
	'previsao',
	'previsao_linha',
	'link',
	'empresa',
	'empresa_sufixo',
	'valor_total',
])

export function clampEvolutionAutoMessageTemplate(value: string): string {
	return value.slice(0, EVOLUTION_AUTO_MESSAGE_MAX_LENGTH)
}

export function parseEvolutionAutoMessageTemplates(
	raw: unknown,
): EvolutionAutoMessageTemplates {
	if (!raw || typeof raw !== 'object') return {}
	const o = raw as Record<string, unknown>
	const out: EvolutionAutoMessageTemplates = {}
	const opened = o.os_opened ?? o.osOpened
	const ready = o.os_ready_for_pickup ?? o.osReadyForPickup
	if (typeof opened === 'string') {
		out.os_opened = clampEvolutionAutoMessageTemplate(opened)
	}
	if (typeof ready === 'string') {
		out.os_ready_for_pickup = clampEvolutionAutoMessageTemplate(ready)
	}
	return out
}

/**
 * Template efetivo para envio: valor salvo, ou o padrão se a chave nunca existiu.
 * String vazia desliga aquele evento.
 */
export function resolveEvolutionAutoMessageTemplate(
	templates: EvolutionAutoMessageTemplates | undefined,
	event: EvolutionAutoMessageEvent,
): string {
	const raw = templates?.[event]
	if (typeof raw === 'string') return raw
	return DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES[event]
}

export function renderEvolutionAutoMessage(
	template: string,
	vars: EvolutionAutoMessageVars,
): string {
	const rendered = template.replace(
		/\{\{\s*([a-z_]+)\s*\}\}/gi,
		(_match, key: string) => {
			const k = key.toLowerCase()
			if (!TEMPLATE_VAR_KEYS.has(k)) return `{{${key}}}`
			return vars[k as keyof EvolutionAutoMessageVars] ?? ''
		},
	)
	return rendered
		.replace(/\n{3,}/g, '\n\n')
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line, i, arr) => {
			if (line.trim() !== '') return true
			const prev = arr[i - 1]
			const next = arr[i + 1]
			return (
				prev != null && next != null && prev.trim() !== '' && next.trim() !== ''
			)
		})
		.join('\n')
		.trim()
}

export function pickEvolutionHubForAutoMessages<
	T extends {
		metadata: {
			auto_messages_enabled?: boolean
			preferred_for_messages?: boolean
		}
	},
>(hubs: T[]): T | null {
	const enabled = hubs.filter((h) => h.metadata.auto_messages_enabled === true)
	if (enabled.length === 0) return null
	return (
		enabled.find((h) => h.metadata.preferred_for_messages === true) ??
		enabled[0]
	)
}
