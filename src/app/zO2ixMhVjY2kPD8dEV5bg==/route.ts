import { goneCrawlResponse } from '@/lib/utils/gone-crawl-paths'

export function GET () {
  return goneCrawlResponse()
}

export function HEAD () {
  return goneCrawlResponse()
}
