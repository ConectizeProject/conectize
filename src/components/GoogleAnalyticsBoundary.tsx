'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Evita que ChunkLoadError (ou outro erro) do Google Analytics quebre o layout.
 * Em caso de erro (ex.: chunk não carregou), renderiza null.
 */
export class GoogleAnalyticsBoundary extends Component<Props, State> {
  constructor (props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError (): State {
    return { hasError: true }
  }

  componentDidCatch (error: Error): void {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[GoogleAnalytics] Erro ao carregar (layout continua funcionando):', error?.message)
    }
  }

  render (): ReactNode {
    if (this.state.hasError) return null
    return this.props.children
  }
}
