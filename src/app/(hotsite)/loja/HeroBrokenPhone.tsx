'use client'

import { useEffect, useRef } from 'react'
import styles from './loja.module.css'

const shards = [
	{
		id: 'a',
		style: { top: '6%', left: '4%', width: '3.4rem', height: '2.4rem' },
		dx: 18,
		dy: 220,
		sx: -80,
		rot: -22,
		clip: 'polygon(12% 8%, 100% 0, 78% 100%, 0 72%)',
	},
	{
		id: 'b',
		style: { top: '14%', right: '2%', width: '4.1rem', height: '2.8rem' },
		dx: 22,
		dy: 160,
		sx: 110,
		rot: 18,
		clip: 'polygon(0 22%, 100% 0, 86% 100%, 8% 84%)',
	},
	{
		id: 'c',
		style: { top: '38%', left: '-4%', width: '3.2rem', height: '3rem' },
		dx: 14,
		dy: 280,
		sx: -140,
		rot: -12,
		clip: 'polygon(0 0, 94% 18%, 68% 100%, 6% 78%)',
	},
	{
		id: 'd',
		style: { top: '46%', right: '-6%', width: '4.6rem', height: '3.2rem' },
		dx: 26,
		dy: 240,
		sx: 160,
		rot: 26,
		clip: 'polygon(10% 0, 100% 28%, 80% 100%, 0 64%)',
	},
	{
		id: 'e',
		style: { bottom: '18%', left: '8%', width: '3.6rem', height: '2.2rem' },
		dx: 12,
		dy: 340,
		sx: -90,
		rot: -28,
		clip: 'polygon(0 34%, 100% 0, 74% 100%, 8% 100%)',
	},
	{
		id: 'f',
		style: { bottom: '8%', right: '10%', width: '4.2rem', height: '2.6rem' },
		dx: 20,
		dy: 300,
		sx: 120,
		rot: 14,
		clip: 'polygon(0 0, 100% 22%, 82% 100%, 16% 78%)',
	},
	{
		id: 'g',
		style: { top: '28%', left: '18%', width: '2.1rem', height: '1.6rem' },
		dx: 30,
		dy: 380,
		sx: -60,
		rot: 8,
		clip: 'polygon(0 18%, 100% 0, 70% 100%, 4% 86%)',
	},
	{
		id: 'h',
		style: { top: '62%', right: '22%', width: '2.4rem', height: '1.8rem' },
		dx: 28,
		dy: 420,
		sx: 70,
		rot: -16,
		clip: 'polygon(20% 0, 100% 30%, 76% 100%, 0 70%)',
	},
] as const

function readScrollY() {
	return (
		window.scrollY ||
		document.documentElement.scrollTop ||
		document.body.scrollTop ||
		0
	)
}

export function HeroBrokenPhone({ imageSrc }: { imageSrc: string }) {
	const stageRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const stage = stageRef.current
		if (!stage) return

		let frame = 0
		let pointerX = 0
		let originTop: number | null = null

		const paint = () => {
			frame = 0
			const rect = stage.getBoundingClientRect()
			if (originTop === null) originTop = rect.top
			const y = readScrollY()
			const fromOrigin =
				(originTop - rect.top) / Math.max(1, window.innerHeight * 0.48)
			const fromScroll = y / Math.max(1, window.innerHeight * 0.42)
			const progress = Math.max(
				0,
				Math.min(1.45, Math.max(fromOrigin, fromScroll)),
			)
			stage.style.setProperty('--mx', pointerX.toFixed(4))
			stage.style.setProperty('--my', progress.toFixed(4))
		}

		const requestPaint = () => {
			if (frame) return
			frame = window.requestAnimationFrame(paint)
		}

		const onPointer = (event: PointerEvent) => {
			const rect = stage.getBoundingClientRect()
			pointerX = Math.max(
				-1,
				Math.min(
					1,
					(event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.8),
				),
			)
			requestPaint()
		}

		const scrollOpts: AddEventListenerOptions = { passive: true, capture: true }
		paint()
		window.addEventListener('scroll', requestPaint, scrollOpts)
		document.addEventListener('scroll', requestPaint, scrollOpts)
		document.body.addEventListener('scroll', requestPaint, { passive: true })
		window.addEventListener('wheel', requestPaint, { passive: true })
		window.addEventListener('touchmove', requestPaint, { passive: true })
		window.addEventListener('resize', requestPaint)
		window.addEventListener('pointermove', onPointer, { passive: true })

		return () => {
			window.removeEventListener('scroll', requestPaint, scrollOpts)
			document.removeEventListener('scroll', requestPaint, scrollOpts)
			document.body.removeEventListener('scroll', requestPaint)
			window.removeEventListener('wheel', requestPaint)
			window.removeEventListener('touchmove', requestPaint)
			window.removeEventListener('resize', requestPaint)
			window.removeEventListener('pointermove', onPointer)
			if (frame) window.cancelAnimationFrame(frame)
		}
	}, [])

	return (
		<div ref={stageRef} className={styles.phoneStage} aria-hidden="true">
			<div className={styles.phoneGlow} />
			<div className={styles.phoneFrame}>
				<img
					src={imageSrc}
					alt=""
					width={900}
					height={1200}
					className={styles.phoneImage}
					decoding="async"
				/>
				<div className={styles.phoneCrack} />
			</div>
			{shards.map((shard) => (
				<span
					key={shard.id}
					className={styles.shard}
					style={{
						...shard.style,
						clipPath: shard.clip,
						['--dx' as string]: `${shard.dx}px`,
						['--dy' as string]: `${shard.dy}px`,
						['--sx' as string]: `${shard.sx}px`,
						['--rot' as string]: `${shard.rot}deg`,
					}}
				/>
			))}
		</div>
	)
}
