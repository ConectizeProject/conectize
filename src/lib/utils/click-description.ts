import { SERVICE_WARRANTY_MONTHS } from '@/lib/data/site-facts'

const MIN_DESCRIPTION = 140
const MAX_DESCRIPTION = 155

function normalize(value: string) {
	return value.replace(/\s+/g, ' ').trim()
}

function fillDescription(lead: string, extras: string[]): string | null {
	if (lead.length >= MIN_DESCRIPTION && lead.length <= MAX_DESCRIPTION)
		return lead

	function walk(text: string, start: number): string | null {
		if (text.length >= MIN_DESCRIPTION && text.length <= MAX_DESCRIPTION)
			return text
		for (let index = start; index < extras.length; index += 1) {
			const next = `${text} ${extras[index]}`
			if (next.length > MAX_DESCRIPTION) continue
			const found = walk(next, index + 1)
			if (found) return found
		}
		return null
	}

	return walk(lead, 0)
}

/**
 * Junta frases completas até cair em 140–155 caracteres.
 * Nunca corta no meio da frase.
 */
export function assembleClickDescription(
	leads: string[],
	extras: string[],
): string {
	const leadOptions = leads
		.map(normalize)
		.filter((lead) => lead.endsWith('.') && lead.length <= MAX_DESCRIPTION)
	const extraOptions = extras
		.map(normalize)
		.filter((extra) => extra.endsWith('.') && extra.length <= MAX_DESCRIPTION)

	for (const lead of leadOptions) {
		const fitted = fillDescription(lead, extraOptions)
		if (fitted) return fitted
	}

	const sample = leadOptions[0] || leads[0] || ''
	throw new Error(
		`Meta description fora de ${MIN_DESCRIPTION}-${MAX_DESCRIPTION}: ${sample}`,
	)
}

const warrantyClause = `com garantia de ${SERVICE_WARRANTY_MONTHS} meses`
const warrantySentence = `Garantia de ${SERVICE_WARRANTY_MONTHS} meses.`

const WHATSAPP_EXTRAS = [
	warrantySentence,
	'Coleta em domicílio e orçamento rápido pelo WhatsApp.',
	'Orçamento rápido pelo WhatsApp, com coleta em domicílio.',
	'Peça o orçamento pelo WhatsApp da Conectize.',
	'Orçamento rápido pelo WhatsApp.',
	'Atendimento na loja de Santa Efigênia.',
	'Chame no WhatsApp da Conectize.',
]

export function serviceClickDescription(
	phrase: string,
	device: string,
): string {
	return assembleClickDescription(
		[
			`${phrase} do ${device} em Belo Horizonte, ${warrantyClause}.`,
			`${phrase} do ${device} em BH, ${warrantyClause} e peça de qualidade.`,
			`${phrase} do ${device} em BH, ${warrantyClause}.`,
			`${phrase} do ${device}. ${warrantySentence}`,
			`${phrase} ${device}. ${warrantySentence}`,
		],
		WHATSAPP_EXTRAS,
	)
}

export function batteryClickDescription(device: string): string {
	return assembleClickDescription(
		[
			`Troca de bateria do ${device} em Belo Horizonte, ${warrantyClause}.`,
			`Troca de bateria do ${device} em BH, ${warrantyClause} e peça de qualidade.`,
			`Troca de bateria do ${device} em BH, ${warrantyClause}.`,
			`Troca de bateria do ${device}. ${warrantySentence}`,
		],
		[
			warrantySentence,
			'Coleta em domicílio e orçamento pelo WhatsApp.',
			'Peça o orçamento pelo WhatsApp da Conectize.',
			'Orçamento rápido pelo WhatsApp.',
			'Atendimento em Santa Efigênia, BH.',
		],
	)
}
