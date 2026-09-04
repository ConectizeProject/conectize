import { describe, expect, it } from 'vitest'
import {
	buildMeliMosaicCells,
	buildMeliMosaicGridSlots,
	meliMosaicUsesGrid,
} from './meli-listing-mosaic'

describe('buildMeliMosaicCells', () => {
	it('shows a single photo when there is one variation', () => {
		expect(buildMeliMosaicCells(['a.jpg'])).toEqual([
			{ kind: 'image', url: 'a.jpg' },
		])
	})

	it('shows two photos when there are two variations', () => {
		expect(buildMeliMosaicCells(['a.jpg', 'b.jpg'])).toEqual([
			{ kind: 'image', url: 'a.jpg' },
			{ kind: 'image', url: 'b.jpg' },
		])
	})

	it('shows four photos when there are four variations', () => {
		const cells = buildMeliMosaicCells(['a', 'b', 'c', 'd'])
		expect(cells).toHaveLength(4)
		expect(cells.every((cell) => cell.kind === 'image')).toBe(true)
	})

	it('replaces the fourth slot with leftover count when there are more than four', () => {
		expect(buildMeliMosaicCells(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual([
			{ kind: 'image', url: 'a' },
			{ kind: 'image', url: 'b' },
			{ kind: 'image', url: 'c' },
			{ kind: 'overflow', extra: 3 },
		])
	})
})

describe('buildMeliMosaicGridSlots', () => {
	it('pads two photos into a 2x2 grid with empty bottom row', () => {
		expect(buildMeliMosaicGridSlots(['a', 'b'])).toEqual([
			{ kind: 'image', url: 'a' },
			{ kind: 'image', url: 'b' },
			{ kind: 'empty' },
			{ kind: 'empty' },
		])
	})

	it('pads three photos into a 2x2 grid with one empty slot', () => {
		expect(buildMeliMosaicGridSlots(['a', 'b', 'c'])).toEqual([
			{ kind: 'image', url: 'a' },
			{ kind: 'image', url: 'b' },
			{ kind: 'image', url: 'c' },
			{ kind: 'empty' },
		])
	})
})

describe('meliMosaicUsesGrid', () => {
	it('uses grid layout for two or more thumbs', () => {
		expect(meliMosaicUsesGrid(1)).toBe(false)
		expect(meliMosaicUsesGrid(2)).toBe(true)
		expect(meliMosaicUsesGrid(3)).toBe(true)
	})
})
