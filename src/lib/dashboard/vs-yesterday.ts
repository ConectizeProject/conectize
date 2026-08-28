export type VsYesterdayDirection = 'up' | 'down' | 'flat'

export type VsYesterdayDelta = {
	percent: number | null
	direction: VsYesterdayDirection
}

export function vsYesterdayDelta (
	todayCents: number,
	yesterdayCents: number,
): VsYesterdayDelta {
	const today = Number(todayCents) || 0
	const yesterday = Number(yesterdayCents) || 0
	if (yesterday === 0) {
		if (today === 0) return { percent: 0, direction: 'flat' }
		return { percent: null, direction: 'up' }
	}
	const percent = Math.round(((today - yesterday) / yesterday) * 100)
	if (percent > 0) return { percent, direction: 'up' }
	if (percent < 0) return { percent, direction: 'down' }
	return { percent: 0, direction: 'flat' }
}

export function vsYesterdayLabel (delta: VsYesterdayDelta): string {
	if (delta.percent == null) return '+'
	if (delta.percent === 0) return '0%'
	const sign = delta.percent > 0 ? '+' : ''
	return `${sign}${delta.percent}%`
}
