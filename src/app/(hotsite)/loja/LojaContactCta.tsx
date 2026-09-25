import { business } from '@/lib/data/business'
import { lojaWhatsAppHref } from '@/lib/data/hotsite-loja'
import { LojaWhatsAppLink } from './LojaWhatsAppLink'
import styles from './loja.module.css'
import { WhatsAppIcon } from './WhatsAppIcon'

export function LojaContactCta ({
	whatsappHref = lojaWhatsAppHref,
}: {
	whatsappHref?: string
}) {
	return (
		<section
			id="contato"
			className={styles.section}
			aria-labelledby="contato-titulo"
		>
			<div className={styles.wrap}>
				<div className={styles.ctaBand}>
					<h2 id="contato-titulo">Peça seu orçamento agora</h2>
					<p>
						Informe o modelo do aparelho e o produto que você procura.
						Respondemos pelo WhatsApp com as opções da loja.
					</p>
					<div className={styles.ctaActions}>
						<LojaWhatsAppLink
							className={styles.ctaWhatsapp}
							href={whatsappHref}
							placement="contato"
						>
							<WhatsAppIcon className="h-5 w-5" />
							Falar no WhatsApp
						</LojaWhatsAppLink>
						<a className={styles.ctaGhost} href={`tel:${business.phone}`}>
							Ligar {business.phoneDisplay}
						</a>
					</div>
				</div>
			</div>
		</section>
	)
}
