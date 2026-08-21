import { describe, expect, it } from 'vitest'
import {
	DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES,
	parseEvolutionAutoMessageTemplates,
	pickEvolutionHubForAutoMessages,
	renderEvolutionAutoMessage,
	resolveEvolutionAutoMessageTemplate,
} from '@/lib/whatsapp/evolution-auto-messages'

function hub(
	id: string,
	meta: {
		auto_messages_enabled?: boolean
		preferred_for_messages?: boolean
	},
) {
	return {
		id,
		metadata: { instance_name: id, ...meta },
	}
}

const emptyVars = {
	nome: '',
	nome_completo: '',
	os: '',
	titulo: '',
	aparelho: '',
	status: '',
	previsao: '',
	previsao_linha: '',
	link: '',
	empresa: '',
	empresa_sufixo: '',
	valor_total: '',
}

describe('parseEvolutionAutoMessageTemplates', () => {
	it('aceita chaves camelCase e corta o tamanho', () => {
		const parsed = parseEvolutionAutoMessageTemplates({
			osOpened: 'abertura',
			osReadyForPickup: 'pronta',
		})
		expect(parsed.os_opened).toBe('abertura')
		expect(parsed.os_ready_for_pickup).toBe('pronta')
	})
})

describe('resolveEvolutionAutoMessageTemplate', () => {
	it('usa o padrão quando a chave nunca foi salva', () => {
		expect(resolveEvolutionAutoMessageTemplate({}, 'os_opened')).toBe(
			DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_opened,
		)
	})

	it('respeita template vazio para desligar o evento', () => {
		expect(
			resolveEvolutionAutoMessageTemplate(
				{ os_opened: '  ' },
				'os_opened',
			).trim(),
		).toBe('')
	})
})

describe('renderEvolutionAutoMessage', () => {
	it('substitui placeholders conhecidos', () => {
		const text = renderEvolutionAutoMessage(
			'Olá {{nome}}, OS #{{os}} da {{ empresa }}.',
			{
				...emptyVars,
				nome: 'Ana',
				os: '12',
				empresa: 'Loja Centro',
			},
		)
		expect(text).toBe('Olá Ana, OS #12 da Loja Centro.')
	})

	it('mantém placeholder desconhecido', () => {
		expect(renderEvolutionAutoMessage('x {{foo}} y', emptyVars)).toBe(
			'x {{foo}} y',
		)
	})

	it('remove linha de previsão vazia no modelo padrão de abertura', () => {
		const text = renderEvolutionAutoMessage(
			DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_opened,
			{
				...emptyVars,
				nome: 'Ana',
				os: '12',
				titulo: 'Tela',
				aparelho: 'iPhone 13',
				status: 'Orçamento',
				empresa_sufixo: ' - Loja',
				link: 'https://exemplo/os/abc',
			},
		)
		expect(text).toContain(
			'Olá Ana, segue abaixo os dados da sua ordem de serviço:',
		)
		expect(text).toContain('*Ordem de Serviço #12* - Loja')
		expect(text).not.toContain('Previsão:')
		expect(text).toContain('Acesse sua OS: https://exemplo/os/abc')
	})
})

describe('pickEvolutionHubForAutoMessages', () => {
	it('prefere a instância marcada como preferida entre as habilitadas', () => {
		const picked = pickEvolutionHubForAutoMessages([
			hub('a', { auto_messages_enabled: true }),
			hub('b', { auto_messages_enabled: true, preferred_for_messages: true }),
			hub('c', { preferred_for_messages: true }),
		])
		expect(picked?.id).toBe('b')
	})

	it('retorna null quando nenhuma instância está habilitada', () => {
		expect(
			pickEvolutionHubForAutoMessages([
				hub('a', { preferred_for_messages: true }),
			]),
		).toBeNull()
	})
})
