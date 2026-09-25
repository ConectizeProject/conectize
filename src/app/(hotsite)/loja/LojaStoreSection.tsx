import { Clock, MapPin } from 'lucide-react'
import { business, getFormattedOpeningHours } from '@/lib/data/business'
import {
	lojaCategoryAddress,
} from '@/lib/data/hotsite-loja'
import styles from './loja.module.css'

export function LojaStoreSection ({
	streetAddress = business.address.streetAddress,
	localityLine = `${business.address.neighborhood}, ${business.address.addressLocality} - ${business.address.addressRegion} ${business.address.postalCode}`,
}: {
	streetAddress?: string
	localityLine?: string
}) {
	const hours = getFormattedOpeningHours()

	return (
		<section
			id="unidade"
			className={`${styles.section} ${styles.sectionAlt}`}
			aria-labelledby="unidade-titulo"
		>
			<div className={styles.wrap}>
				<div className={styles.storeGrid}>
					<div className={styles.storeCopy}>
						<p className={styles.kicker}>Unidade</p>
						<h2 id="unidade-titulo">Visite a loja em Santa Efigênia</h2>
						<p>
							Atendimento presencial em Belo Horizonte. Se preferir, chame no
							WhatsApp para confirmar estoque e horário antes de vir.
						</p>
					</div>
					<ul className={styles.storeMeta}>
						<li className={styles.metaRow}>
							<MapPin
								className={`${styles.accentIcon} h-5 w-5`}
								aria-hidden="true"
							/>
							<div>
								<p className={styles.metaTitle}>{streetAddress}</p>
								<p className="mt-1">{localityLine}</p>
								<a
									href={business.hasMap}
									target="_blank"
									rel="noopener noreferrer"
								>
									Abrir no Google Maps
								</a>
							</div>
						</li>
						<li className={styles.metaRow}>
							<Clock
								className={`${styles.accentIcon} h-5 w-5`}
								aria-hidden="true"
							/>
							<div>
								{hours.map((item) => (
									<p key={item}>{item}</p>
								))}
							</div>
						</li>
					</ul>
				</div>
			</div>
		</section>
	)
}

export const lojaCategoryLocalityLine = `${lojaCategoryAddress.neighborhood}, ${lojaCategoryAddress.addressLocality} - ${lojaCategoryAddress.addressRegion} ${lojaCategoryAddress.postalCode}`
