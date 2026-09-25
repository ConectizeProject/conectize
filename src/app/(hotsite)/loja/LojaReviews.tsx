import { Star } from 'lucide-react'
import { lojaGoogleRating, lojaTestimonials } from '@/lib/data/hotsite-loja'
import styles from './loja.module.css'

type LojaReview = {
	name: string
	quote: string
}

export function LojaReviews ({
	testimonials = lojaTestimonials,
}: {
	testimonials?: readonly LojaReview[]
}) {
	return (
		<section
			id="avaliacoes"
			className={styles.reviews}
			aria-labelledby="avaliacoes-titulo"
		>
			<div className={styles.wrap}>
				<div className={styles.reviewsHead}>
					<p className={styles.reviewsKicker}>Avaliações</p>
					<h2 id="avaliacoes-titulo">O que os clientes dizem sobre a gente</h2>
				</div>

				<div className={styles.reviewsScore}>
					<p className={styles.reviewsScoreValue}>
						{lojaGoogleRating.ratingValue.toFixed(1)}
					</p>
					<div className={styles.reviewsScoreMeta}>
						<div
							className={styles.reviewsStars}
							aria-label={`${lojaGoogleRating.ratingValue} de 5 estrelas`}
						>
							{Array.from({ length: 5 }).map((_, index) => (
								<Star
									key={index}
									className={styles.reviewsStar}
									aria-hidden="true"
								/>
							))}
						</div>
						<p>
							{lojaGoogleRating.reviewCountLabel} avaliações no{' '}
							{lojaGoogleRating.sourceLabel}
						</p>
						<a
							href={lojaGoogleRating.mapsUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							Ver no Google
						</a>
					</div>
				</div>

				<div className={styles.reviewsGrid}>
					{testimonials.map((item) => (
						<figure key={item.name} className={styles.reviewCard}>
							<div className={styles.reviewsStars} aria-hidden="true">
								{Array.from({ length: 5 }).map((_, index) => (
									<Star key={index} className={styles.reviewsStar} />
								))}
							</div>
							<blockquote>
								<p>“{item.quote}”</p>
							</blockquote>
							<figcaption>
								<strong>{item.name}</strong>
							</figcaption>
						</figure>
					))}
				</div>
			</div>
		</section>
	)
}
