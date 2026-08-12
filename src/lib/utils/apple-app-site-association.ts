/** Payload vazio: site sem Universal Links / Associated Domains. */
export const EMPTY_APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    apps: [] as string[],
    details: [] as Array<Record<string, unknown>>,
  },
  webcredentials: {
    apps: [] as string[],
  },
  activitycontinuation: {
    apps: [] as string[],
  },
}

export function appleAppSiteAssociationResponse (): Response {
  return Response.json(EMPTY_APPLE_APP_SITE_ASSOCIATION, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
