import { deflateRawSync } from 'node:zlib'

export type ZipFile = {
	name: string
	content: Buffer
}

const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
	let c = i
	for (let j = 0; j < 8; j++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
	}
	CRC_TABLE[i] = c >>> 0
}

function crc32(buf: Buffer) {
	let crc = 0xffffffff
	for (let i = 0; i < buf.length; i++) {
		crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
	}
	return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date) {
	const year = date.getFullYear()
	const month = date.getMonth() + 1
	const day = date.getDate()
	const hours = date.getHours()
	const minutes = date.getMinutes()
	const seconds = Math.floor(date.getSeconds() / 2)
	const time = (hours << 11) | (minutes << 5) | seconds
	const dosDate = ((Math.max(year, 1980) - 1980) << 9) | (month << 5) | day
	return { time, date: dosDate }
}

function u16(value: number) {
	const buf = Buffer.alloc(2)
	buf.writeUInt16LE(value >>> 0, 0)
	return buf
}

function u32(value: number) {
	const buf = Buffer.alloc(4)
	buf.writeUInt32LE(value >>> 0, 0)
	return buf
}

/** ZIP com DEFLATE (sem dependência extra), nomes em UTF-8. */
export function buildZip(files: ZipFile[], now = new Date()): Buffer {
	const { time, date } = dosDateTime(now)
	const locals: Buffer[] = []
	const centrals: Buffer[] = []
	let offset = 0

	for (const file of files) {
		const name = Buffer.from(file.name.replace(/\\/g, '/'), 'utf8')
		const uncompressed = file.content
		const compressed = deflateRawSync(uncompressed)
		const crc = crc32(uncompressed)
		const flags = 1 << 11
		const compression = 8

		const local = Buffer.concat([
			Buffer.from([0x50, 0x4b, 0x03, 0x04]),
			u16(20),
			u16(flags),
			u16(compression),
			u16(time),
			u16(date),
			u32(crc),
			u32(compressed.length),
			u32(uncompressed.length),
			u16(name.length),
			u16(0),
			name,
			compressed,
		])

		const central = Buffer.concat([
			Buffer.from([0x50, 0x4b, 0x01, 0x02]),
			u16(20),
			u16(20),
			u16(flags),
			u16(compression),
			u16(time),
			u16(date),
			u32(crc),
			u32(compressed.length),
			u32(uncompressed.length),
			u16(name.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			name,
		])

		locals.push(local)
		centrals.push(central)
		offset += local.length
	}

	const centralDir = Buffer.concat(centrals)
	const eocd = Buffer.concat([
		Buffer.from([0x50, 0x4b, 0x05, 0x06]),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(centralDir.length),
		u32(offset),
		u16(0),
	])

	return Buffer.concat([...locals, centralDir, eocd])
}
