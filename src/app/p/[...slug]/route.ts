import { goneCrawlResponse, isGoneCrawlPath } from '@/lib/utils/gone-crawl-paths'

type RouteContext = {
  params: Promise<{ slug: string[] }>
}

export async function GET (_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const pathname = `/p/${slug.join('/')}`
  if (!isGoneCrawlPath(pathname)) return new Response('Not Found', { status: 404 })
  return goneCrawlResponse()
}

export async function HEAD (_request: Request, context: RouteContext) {
  return GET(_request, context)
}
