import { NextRequest, NextResponse } from 'next/server'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { downloadStoragePhotoResponse } from '@/lib/orders/serve-service-order-photo'
import type { ServiceOrderPhotoTable } from '@/lib/orders/service-order-photo-storage'

const STAGE_MAP = {
  entry: {
    table: 'service_order_entry_photos' as const satisfies ServiceOrderPhotoTable,
    bucket: 'order-entry-photos',
  },
  exit: {
    table: 'service_order_exit_photos' as const satisfies ServiceOrderPhotoTable,
    bucket: 'order-exit-photos',
  },
  assistance: {
    table: 'service_order_assistance_photos' as const satisfies ServiceOrderPhotoTable,
    bucket: 'order-assistance-photos',
  },
}

type StageKey = keyof typeof STAGE_MAP

function isStage (value: string): value is StageKey {
  return value === 'entry' || value === 'exit' || value === 'assistance'
}

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ token: string; stage: string; photoId: string }> },
) {
  const { token, stage, photoId: rawPhotoId } = await params
  const photoId = parseOptionalUuid(rawPhotoId)
  if (!token || !photoId || !isStage(stage)) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  let supabase
  try {
    supabase = createSupabaseServiceClient()
  } catch {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })
  }

  const { data: order } = await supabase
    .from('service_orders')
    .select('id')
    .eq('share_token', token)
    .maybeSingle()

  if (!order?.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const meta = STAGE_MAP[stage]
  const { data: row, error } = await supabase
    .from(meta.table)
    .select('id, storage_path')
    .eq('id', photoId)
    .eq('service_order_id', order.id)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const variant =
    request.nextUrl.searchParams.get('variant') === 'full' ? 'full' : 'thumb'

  return downloadStoragePhotoResponse({
    bucket: meta.bucket,
    storagePath: String(row.storage_path || ''),
    variant,
  })
}
