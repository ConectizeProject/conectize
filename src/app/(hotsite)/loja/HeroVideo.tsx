'use client'

import { type SyntheticEvent } from 'react'
import styles from './loja.module.css'

export function HeroVideo() {
	function handleReady(event: SyntheticEvent<HTMLVideoElement>) {
		const video = event.currentTarget
		video.muted = true
		video.playsInline = true
		void video.play()
	}

	return (
		<video
			className={styles.heroVideo}
			src="/loja/hero.mp4"
			autoPlay
			muted
			loop
			playsInline
			preload="auto"
			controls={false}
			disablePictureInPicture
			onLoadedData={handleReady}
			onCanPlay={handleReady}
		/>
	)
}
