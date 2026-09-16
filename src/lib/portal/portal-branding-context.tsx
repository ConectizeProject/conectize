'use client'

import { createContext, useContext, type ReactNode } from 'react'

type PortalBrandingValue = {
  /** Nome cadastrado em `organizations.name` para a org ativa do portal. */
  organizationName: string | null
  /** ID da organização ativa no portal. */
  organizationId: string | null
}

const PortalBrandingContext = createContext<PortalBrandingValue>({
  organizationName: null,
  organizationId: null,
})

export function PortalBrandingProvider ({
  organizationName,
  organizationId = null,
  children,
}: {
  organizationName: string | null
  organizationId?: string | null
  children: ReactNode
}) {
  return (
    <PortalBrandingContext.Provider value={{ organizationName, organizationId }}>
      {children}
    </PortalBrandingContext.Provider>
  )
}

export function usePortalOrganizationName (): string | null {
  return useContext(PortalBrandingContext).organizationName
}

export function usePortalOrganizationId (): string | null {
  return useContext(PortalBrandingContext).organizationId
}
