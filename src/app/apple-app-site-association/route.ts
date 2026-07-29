import { appleAppSiteAssociationResponse } from '@/lib/utils/apple-app-site-association'

export function GET (): Response {
  return appleAppSiteAssociationResponse()
}
