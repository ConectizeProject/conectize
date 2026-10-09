/** Meses de garantia de todos os serviços de assistência. */
export const SERVICE_WARRANTY_MONTHS = 12

export const serviceWarranty = {
	months: SERVICE_WARRANTY_MONTHS,
	duration: `${SERVICE_WARRANTY_MONTHS} meses`,
	phrase: `garantia de ${SERVICE_WARRANTY_MONTHS} meses`,
	card: `${SERVICE_WARRANTY_MONTHS} meses nos serviços`,
	includedItem: `Garantia de ${SERVICE_WARRANTY_MONTHS} meses em todos os serviços realizados`,
	coverageSentence: `Oferecemos garantia de ${SERVICE_WARRANTY_MONTHS} meses. A garantia cobre defeitos de fabricação da peça e problemas relacionados à instalação.`,
	faqAnswer: `Sim. Os serviços realizados pela Conectize têm garantia de ${SERVICE_WARRANTY_MONTHS} meses, para defeito de fabricação da peça e problema relacionado à instalação.`,
	serviceAndPart: `Garantia de ${SERVICE_WARRANTY_MONTHS} meses para o serviço e a peça instalada.`,
	standardIs: `A garantia padrão é de ${SERVICE_WARRANTY_MONTHS} meses.`,
} as const

export function warrantyAfterLead (lead: string) {
	return `${lead} ${serviceWarranty.serviceAndPart}`
}

/** Nota e volume das avaliações públicas no Google. */
export const GOOGLE_RATING_VALUE = 5
export const GOOGLE_REVIEW_COUNT = 419

const ratingValueSchema = GOOGLE_RATING_VALUE.toFixed(1)
const ratingValueDisplay = ratingValueSchema.replace('.', ',')

export const googleReviews = {
	ratingValue: GOOGLE_RATING_VALUE,
	ratingValueSchema,
	ratingValueDisplay,
	reviewCount: GOOGLE_REVIEW_COUNT,
	ratingCount: GOOGLE_REVIEW_COUNT,
	bestRating: 5,
	worstRating: 1,
	sourceLabel: 'Google' as const,
	homeLine: `Nota ${ratingValueDisplay} no Google · ${GOOGLE_REVIEW_COUNT} avaliações`,
}

export function googleAggregateRatingJsonLd () {
	return {
		'@type': 'AggregateRating' as const,
		ratingValue: googleReviews.ratingValueSchema,
		bestRating: googleReviews.bestRating,
		worstRating: googleReviews.worstRating,
		ratingCount: googleReviews.ratingCount,
		reviewCount: googleReviews.reviewCount,
	}
}

export const homeMetaDescription = `Conserto de iPhone, iPad e celular em BH, com ${serviceWarranty.phrase} e coleta. Troca de tela, bateria e placa. Orçamento pelo WhatsApp.`
