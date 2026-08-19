/**
 * Remove fotos de OS gravadas corrompidas (upload Buffer/UTF-8).
 * Só apaga se o arquivo no Storage começar com U+FFFD (EF BF BD).
 *
 *   node --env-file=.env.local scripts/delete-corrupt-os-photos.mjs
 *   node --env-file=.env.local scripts/delete-corrupt-os-photos.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const SINCE = '2026-08-15T15:00:00.000Z'
const THUMB_SUFFIX = '.thumb.jpg'

const TARGETS = [
  { table: 'service_order_entry_photos', bucket: 'order-entry-photos', label: 'entrada' },
  { table: 'service_order_exit_photos', bucket: 'order-exit-photos', label: 'saida' },
  { table: 'service_order_assistance_photos', bucket: 'order-assistance-photos', label: 'assistencia' },
]

function toThumbPath (storagePath) {
  const path = storagePath.trim()
  if (!path || path.endsWith(THUMB_SUFFIX)) return path
  const slash = path.lastIndexOf('/')
  const filename = slash >= 0 ? path.slice(slash + 1) : path
  const dir = slash >= 0 ? path.slice(0, slash + 1) : ''
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  return `${dir}${stem}${THUMB_SUFFIX}`
}

function isUtf8Corrupt (bytes) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbf && bytes[2] === 0xbd
}

async function allRows (supabase, table) {
  const pageSize = 1000
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('id, service_order_id, storage_path, created_at')
      .gte('created_at', SINCE)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function magicOf (supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return { kind: 'missing', bytes: 0 }
  const buf = Buffer.from(await data.arrayBuffer())
  if (buf[0] === 0xff && buf[1] === 0xd8) return { kind: 'jpeg', bytes: buf.length }
  if (isUtf8Corrupt(buf)) return { kind: 'corrupt', bytes: buf.length }
  return { kind: 'other', bytes: buf.length }
}

async function main () {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(APPLY ? 'APPLY: apagando arquivos corrompidos' : 'DRY-RUN: nada sera apagado (passe --apply)')
  console.log('Janela:', SINCE, '→ agora')

  const orderIds = new Set()
  let totalCorrupt = 0
  let totalJpeg = 0
  let totalMissing = 0

  for (const target of TARGETS) {
    const rows = await allRows(supabase, target.table)
    const corrupt = []
    for (const row of rows) {
      const path = String(row.storage_path || '').trim()
      if (!path) continue
      const mag = await magicOf(supabase, target.bucket, path)
      if (mag.kind === 'jpeg') {
        totalJpeg += 1
        continue
      }
      if (mag.kind === 'missing') totalMissing += 1
      if (mag.kind === 'corrupt' || mag.kind === 'missing' || mag.kind === 'other') {
        if (mag.kind !== 'corrupt' && mag.kind !== 'missing') {
          console.log('  skip other', target.label, path, mag.kind)
          continue
        }
        corrupt.push(row)
        orderIds.add(row.service_order_id)
      }
    }

    console.log(`${target.label}: candidatas=${rows.length} corrompidas=${corrupt.length}`)
    totalCorrupt += corrupt.length

    if (!APPLY || corrupt.length === 0) continue

    const paths = expandUnique(corrupt.map((r) => String(r.storage_path)))
    for (let i = 0; i < paths.length; i += 50) {
      const chunk = paths.slice(i, i + 50)
      const { error } = await supabase.storage.from(target.bucket).remove(chunk)
      if (error) console.error('storage remove', target.bucket, error.message)
    }

    const ids = corrupt.map((r) => r.id)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { error } = await supabase.from(target.table).delete().in('id', chunk)
      if (error) throw new Error(`delete ${target.table}: ${error.message}`)
    }
    console.log(`  apagadas ${corrupt.length} linhas + storage`)
  }

  console.log('resumo', {
    corrompidas: totalCorrupt,
    jpegValidoNaJanela: totalJpeg,
    ausentesNoStorage: totalMissing,
    osAfetadas: orderIds.size,
  })
}

function expandUnique (storagePaths) {
  const unique = new Set()
  for (const path of storagePaths) {
    unique.add(path)
    unique.add(toThumbPath(path))
  }
  return [...unique]
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
