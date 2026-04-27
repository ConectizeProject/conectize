'use client'

import { createContext, useContext, type ReactNode } from 'react'

type PortalBrandingValue = {
  /** Nome cadastrado em `organizations.name` para a org ativa do portal. */
  organizationName: string | null
}

const PortalBrandingContext = createContext<PortalBrandingValue>({
  organizationName: null,
})

export function PortalBrandingProvider ({
  organizationName,
  children,
}: {
  organizationName: string | null
  children: ReactNode
}) {
  return (
    <PortalBrandingContext.Provider value={{ organizationName }}>
      {children}
    </PortalBrandingContext.Provider>
  )
}

export function usePortalOrganizationName (): string | null {
  return useContext(PortalBrandingContext).organizationName
}
