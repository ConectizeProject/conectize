import { describe, expect, it } from 'vitest'
import {
	buildWhatsAppUrl,
	ensureWhatsAppOriginText,
	WHATSAPP_ORIGIN_MESSAGE,
	whatsappMessageForPath,
} from './business'

describe('whatsapp público', () => {
	it('codifica o texto com encodeURIComponent', () => {
		const message = 'Olá! Vim pelo site da Conectize. '
		expect(buildWhatsAppUrl(message)).toBe(
			`https://wa.me/5531986140889?text=${encodeURIComponent(message)}`,
		)
		expect(buildWhatsAppUrl()).toBe(
			`https://wa.me/5531986140889?text=${encodeURIComponent(WHATSAPP_ORIGIN_MESSAGE)}`,
		)
	})

	it('escolhe a mensagem pela página', () => {
		expect(whatsappMessageForPath('/loja/bateria-iphone')).toBe(
			'Olá! Vim pelo site, página de bateria para iPhone. Meu modelo é: ',
		)
		expect(whatsappMessageForPath('/loja/vidro-traseiro-iphone/')).toBe(
			'Olá! Vim pelo site, página de tampa/vidro traseiro para iPhone. Meu modelo é: ',
		)
		expect(whatsappMessageForPath('/loja/capinhas')).toBe(WHATSAPP_ORIGIN_MESSAGE)
		expect(whatsappMessageForPath('/')).toBe(WHATSAPP_ORIGIN_MESSAGE)
	})

	it('preenche text só no número da loja, sem sobrescrever mensagem existente', () => {
		const withText = 'https://wa.me/5531986140889?text=Ja+tenho'
		expect(ensureWhatsAppOriginText(withText, '/loja')).toBe(withText)
		expect(ensureWhatsAppOriginText('https://wa.me/5531999999999', '/loja')).toBe(
			'https://wa.me/5531999999999',
		)
		const filled = ensureWhatsAppOriginText('https://wa.me/5531986140889', '/loja/bateria-iphone')
		expect(filled).toContain('text=')
		expect(decodeURIComponent(new URL(filled).searchParams.get('text') || '')).toBe(
			whatsappMessageForPath('/loja/bateria-iphone'),
		)
	})
})
