import { inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildZip } from '@/lib/utils/zip'

describe('buildZip', () => {
	it('packs UTF-8 names and recovers the original payload', () => {
		const xml = Buffer.from(
			'<?xml version="1.0" encoding="UTF-8"?><nfeProc/>',
			'utf8',
		)
		const zip = buildZip(
			[{ name: 'NFCe/nota.xml', content: xml }],
			new Date('2026-09-01T12:00:00-03:00'),
		)

		expect(
			zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
		).toBe(true)
		expect(zip.includes(Buffer.from('NFCe/nota.xml'))).toBe(true)

		const nameLen = zip.readUInt16LE(26)
		const extraLen = zip.readUInt16LE(28)
		const compSize = zip.readUInt32LE(18)
		const dataStart = 30 + nameLen + extraLen
		const inflated = inflateRawSync(
			zip.subarray(dataStart, dataStart + compSize),
		)
		expect(inflated.equals(xml)).toBe(true)
		expect(
			zip.subarray(-22, -18).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])),
		).toBe(true)
	})
})
