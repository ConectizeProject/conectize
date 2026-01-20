'use client'

import dynamic from 'next/dynamic'

const FreteCalculator = dynamic(
  () => import('./FreteCalculator').then(m => m.FreteCalculator),
  {
    ssr: false,
    loading: () => <div className="h-[120px] rounded-xl bg-muted/40" />
  }
)

export function FreteCalculatorLazy () {
  return <FreteCalculator />
}

