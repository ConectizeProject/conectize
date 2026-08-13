import type { Metadata } from 'next'
import Link from 'next/link'
import { business } from '@/lib/data/business'
import { lojaCopy, lojaPath } from '@/lib/data/hotsite-loja'
import { getSiteUrl } from '@/lib/utils/site-url'
import { LojaShell } from '../LojaShell'
import styles from '../loja.module.css'

export const metadata: Metadata = {
	title: 'Política de privacidade | Conectize Store',
	description:
		'Como a Conectize Store trata dados de contato enviados por WhatsApp, telefone ou visita à loja em Belo Horizonte.',
	robots: {
		index: true,
		follow: true,
	},
	alternates: {
		canonical: `${getSiteUrl()}${lojaPath}/privacidade`,
	},
}

export default function LojaPrivacidadePage() {
	return (
		<LojaShell>
			<main id="conteudo-principal" className={styles.legal}>
				<h1>Política de privacidade</h1>
				<p>
					Esta página explica como a {lojaCopy.brand} trata dados pessoais de
					quem entra em contato para orçamento de peças e acessórios.
				</p>

				<h2>Quem somos</h2>
				<p>
					Conectize, CNPJ {business.cnpj}, loja em {business.address.full}.
					E-mail: {business.email}. Telefone: {business.phoneDisplay}.
				</p>

				<h2>Dados que recebemos</h2>
				<ul>
					<li>Nome, telefone e mensagem enviados por WhatsApp ou ligação.</li>
					<li>
						Modelo do aparelho e produto de interesse, quando você informa.
					</li>
					<li>
						Dados de visita à loja, se você se identificar no atendimento
						presencial.
					</li>
				</ul>

				<h2>Para que usamos</h2>
				<p>
					Só usamos esses dados para responder orçamentos, confirmar
					disponibilidade de produtos e atender você na loja. Não vendemos
					cadastros.
				</p>

				<h2>WhatsApp</h2>
				<p>
					Conversas iniciadas pelo botão de WhatsApp tramitam na plataforma da
					Meta. A política da Meta também se aplica a essas mensagens.
				</p>

				<h2>Seus direitos</h2>
				<p>
					Você pode pedir acesso, correção ou exclusão dos dados que tivermos.
					Escreva para {business.email} ou fale na loja.
				</p>

				<p>
					<Link href={lojaPath}>Voltar para a loja</Link>
				</p>
			</main>
		</LojaShell>
	)
}
