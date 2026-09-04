export function accountingXmlZipFilename(monthLabel: string) {
	return `xml-nfe-nfce-${monthLabel}.zip`
}

export function accountingXmlFolder(model: '55' | '65') {
	return model === '55' ? 'NFe' : 'NFCe'
}

export function uniqueZipEntryName(used: Set<string>, name: string) {
	if (!used.has(name)) {
		used.add(name)
		return name
	}
	const dot = name.lastIndexOf('.')
	const base = dot >= 0 ? name.slice(0, dot) : name
	const ext = dot >= 0 ? name.slice(dot) : ''
	let i = 2
	let next = `${base}-${i}${ext}`
	while (used.has(next)) {
		i += 1
		next = `${base}-${i}${ext}`
	}
	used.add(next)
	return next
}

export function formatMissingAccountingXmlLine(input: {
	model: '55' | '65'
	series: number
	number: number
	accessKey?: string | null
}) {
	const folder = accountingXmlFolder(input.model)
	const key = String(input.accessKey || '').replace(/\D/g, '')
	const keyPart = key.length === 44 ? ` chave ${key}` : ''
	return `${folder} série ${input.series} nº ${input.number}${keyPart}`
}

export function missingAccountingXmlFile(
	monthDisplayLabel: string,
	lines: string[],
) {
	const header = `Notas de ${monthDisplayLabel} sem XML gravado:`
	return `${header}\n${lines.join('\n')}\n`
}
