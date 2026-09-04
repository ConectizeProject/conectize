import { describe, expect, it } from 'vitest'
import {
	accountingXmlFolder,
	accountingXmlZipFilename,
	formatMissingAccountingXmlLine,
	missingAccountingXmlFile,
	uniqueZipEntryName,
} from '@/lib/fiscal/accounting-xml'

describe('accounting xml helpers', () => {
	it('names the zip with year-month', () => {
		expect(accountingXmlZipFilename('2026-08')).toBe('xml-nfe-nfce-2026-08.zip')
	})

	it('separates NF-e and NFC-e folders', () => {
		expect(accountingXmlFolder('55')).toBe('NFe')
		expect(accountingXmlFolder('65')).toBe('NFCe')
	})

	it('avoids colliding zip entry names', () => {
		const used = new Set<string>()
		expect(uniqueZipEntryName(used, 'NFe/a.xml')).toBe('NFe/a.xml')
		expect(uniqueZipEntryName(used, 'NFe/a.xml')).toBe('NFe/a-2.xml')
		expect(uniqueZipEntryName(used, 'NFe/a.xml')).toBe('NFe/a-3.xml')
	})

	it('lists notes without xml', () => {
		expect(
			formatMissingAccountingXmlLine({
				model: '65',
				series: 1,
				number: 12,
				accessKey: '31260812345678000155650020000000011000000010',
			}),
		).toBe(
			'NFCe série 1 nº 12 chave 31260812345678000155650020000000011000000010',
		)

		expect(missingAccountingXmlFile('08/2026', ['NFCe série 1 nº 12'])).toBe(
			'Notas de 08/2026 sem XML gravado:\nNFCe série 1 nº 12\n',
		)
	})
})
