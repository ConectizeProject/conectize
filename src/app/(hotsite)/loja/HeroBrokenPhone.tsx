'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import styles from './loja.module.css'

const PHONE_SRC = '/loja/iphone-tela.png'
const PHONE_WIDTH = 867
const PHONE_HEIGHT = 783

type HeroBrokenPhoneProps = {
	src?: string
	width?: number
	height?: number
	alt?: string
	sizes?: string
	portrait?: boolean
}

function getTiltMedia() {
	return {
		motion: window.matchMedia('(prefers-reduced-motion: reduce)'),
		fine: window.matchMedia('(pointer: fine)'),
		hover: window.matchMedia('(hover: hover)'),
	}
}

function canTilt(media: ReturnType<typeof getTiltMedia>) {
	return !media.motion.matches && media.fine.matches && media.hover.matches
}

function clamp(value: number) {
	return Math.max(-1, Math.min(1, value))
}

export function HeroBrokenPhone({
	src = PHONE_SRC,
	width = PHONE_WIDTH,
	height = PHONE_HEIGHT,
	alt = 'iPhone com a tela trincada, na loja de peças da Conectize em Belo Horizonte',
	sizes = '(min-width: 900px) 448px, 336px',
	portrait = false,
}: HeroBrokenPhoneProps = {}) {
	const stageRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const stage = stageRef.current
		if (!stage) return

		const media = getTiltMedia()
		let frame = 0
		let tracking = false
		let targetX = 0
		let targetY = 0
		let currentX = 0
		let currentY = 0

		const setTilt = (x: number, y: number) => {
			stage.style.setProperty('--tx', x.toFixed(4))
			stage.style.setProperty('--ty', y.toFixed(4))
		}

		const resetTilt = () => {
			tracking = false
			targetX = 0
			targetY = 0
			currentX = 0
			currentY = 0
			setTilt(0, 0)
		}

		const paint = () => {
			frame = 0
			if (tracking) {
				currentX = targetX
				currentY = targetY
				setTilt(currentX, currentY)
				return
			}

			currentX += (targetX - currentX) * 0.16
			currentY += (targetY - currentY) * 0.16
			if (Math.abs(currentX) < 0.002 && Math.abs(currentY) < 0.002) {
				resetTilt()
				return
			}

			setTilt(currentX, currentY)
			frame = window.requestAnimationFrame(paint)
		}

		const requestPaint = () => {
			if (frame) return
			frame = window.requestAnimationFrame(paint)
		}

		const onPointerMove = (event: PointerEvent) => {
			if (!canTilt(media)) return
			const rect = stage.getBoundingClientRect()
			tracking = true
			targetX = clamp(
				(event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.55),
			)
			targetY = clamp(
				(event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.55),
			)
			currentX = targetX
			currentY = targetY
			requestPaint()
		}

		const onPointerLeave = () => {
			tracking = false
			targetX = 0
			targetY = 0
			requestPaint()
		}

		const onMediaChange = () => {
			if (canTilt(media)) return
			if (frame) window.cancelAnimationFrame(frame)
			frame = 0
			resetTilt()
		}

		stage.addEventListener('pointermove', onPointerMove, { passive: true })
		stage.addEventListener('pointerleave', onPointerLeave)
		stage.addEventListener('pointercancel', onPointerLeave)
		media.motion.addEventListener('change', onMediaChange)
		media.fine.addEventListener('change', onMediaChange)
		media.hover.addEventListener('change', onMediaChange)

		return () => {
			stage.removeEventListener('pointermove', onPointerMove)
			stage.removeEventListener('pointerleave', onPointerLeave)
			stage.removeEventListener('pointercancel', onPointerLeave)
			media.motion.removeEventListener('change', onMediaChange)
			media.fine.removeEventListener('change', onMediaChange)
			media.hover.removeEventListener('change', onMediaChange)
			if (frame) window.cancelAnimationFrame(frame)
		}
	}, [])

	return (
		<div
			ref={stageRef}
			className={portrait ? `${styles.phoneStage} ${styles.phonePortrait}` : styles.phoneStage}
			aria-hidden={alt ? undefined : true}
		>
			<div className={styles.phoneGlow} />
			<div className={styles.phoneShadow} />
			<div className={styles.phoneFrame}>
				<Image
					src={src}
					alt={alt}
					width={width}
					height={height}
					className={styles.phoneImage}
					priority
					sizes={portrait ? '(min-width: 900px) 384px, 256px' : sizes}
				/>
			</div>
		</div>
	)
}
