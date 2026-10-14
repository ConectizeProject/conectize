'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, PieChart, Tag } from 'lucide-react'
import { abcItemsForMode, classifyAbc, type AbcClassName, type AbcClassSlice, type AbcSkuRow } from '@/lib/reports/abc-curve'
import { maskedFromCents } from '@/lib/utils/money'

const CLASS_COLOR: Record<AbcClassName, string> = {
  A: 'hsl(199 89% 62%)',
  B: 'hsl(199 75% 40%)',
  C: 'hsl(201 45% 22%)',
}

const CLASS_LABEL: Record<AbcClassName, string> = {
  A: 'Curva A',
  B: 'Curva B',
  C: 'Curva C',
}

type Mode = 'sku' | 'product'

function money (cents: number) {
  return `R$ ${maskedFromCents(cents) || '0,00'}`
}

function polar (cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function slicePath (cx: number, cy: number, radius: number, start: number, end: number) {
  const from = polar(cx, cy, radius, start)
  const to = polar(cx, cy, radius, end)
  const large = end - start > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y} Z`
}

function AbcPie ({ slices }: { slices: AbcClassSlice[] }) {
  const visible = slices.filter((slice) => slice.revenueCents > 0)
  const cx = 160
  const cy = 110
  const radius = 78
  let cursor = 0
  const arcs = visible.map((slice) => {
    const sweep = (slice.percent / 100) * 360
    const start = cursor
    cursor += sweep
    return { slice, start, end: cursor }
  })

  return (
    <svg viewBox='0 0 320 220' className='mx-auto h-auto w-full max-w-[420px]' role='img' aria-label='Gráfico da Curva ABC'>
      {arcs.length === 1 ? (
        <g>
          <circle cx={cx} cy={cy} r={radius} fill={CLASS_COLOR[arcs[0].slice.className]} />
          <text x={cx} y={cy} textAnchor='middle' fill={arcs[0].slice.className === 'A' ? 'hsl(201 45% 16%)' : 'white'} fontSize='12' fontWeight='600'>
            <tspan x={cx} dy='-0.2em'>{money(arcs[0].slice.revenueCents)}</tspan>
            <tspan x={cx} dy='1.3em'>{arcs[0].slice.percent}%</tspan>
          </text>
        </g>
      ) : arcs.map(({ slice, start, end }) => {
        const mid = start + (end - start) / 2
        const label = polar(cx, cy, radius * 0.62, mid)
        return (
          <g key={slice.className}>
            <path d={slicePath(cx, cy, radius, start, Math.max(end - 0.05, start))} fill={CLASS_COLOR[slice.className]}>
              <title>{`${CLASS_LABEL[slice.className]}: ${money(slice.revenueCents)} (${slice.percent}%)`}</title>
            </path>
            {slice.percent >= 20 ? (
              <text x={label.x} y={label.y} textAnchor='middle' fill={slice.className === 'A' ? 'hsl(201 45% 16%)' : 'white'} fontSize='11' fontWeight='600'>
                <tspan x={label.x} dy='-0.2em'>{money(slice.revenueCents)}</tspan>
                <tspan x={label.x} dy='1.3em'>{slice.percent}%</tspan>
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function AbcCurveList ({ slice }: { slice: AbcClassSlice }) {
  return (
    <details className='group border-b border-border/70'>
      <summary className='flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden'>
        <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
        {CLASS_LABEL[slice.className]}
      </summary>
      {slice.items.length === 0 ? (
        <p className='pb-3 text-sm text-muted-foreground'>Nenhum SKU nesta curva.</p>
      ) : (
        <ul className='max-h-72 space-y-2 overflow-y-auto pb-3'>
          {slice.items.map((item) => (
            <li key={item.id} className='flex items-start justify-between gap-3 text-sm'>
              <span>
                <span className='block font-medium'>{item.name}</span>
                {item.sku ? <span className='text-muted-foreground'>{item.sku}</span> : null}
              </span>
              <span className='shrink-0 tabular-nums text-muted-foreground'>
                {money(item.revenueCents)}
                {' '}
                ({item.sharePercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

export function CurvaAbcClient ({ skus }: { skus: AbcSkuRow[] }) {
  const [mode, setMode] = useState<Mode>('sku')
  const slices = useMemo(
    () => classifyAbc(abcItemsForMode(skus, mode)),
    [mode, skus],
  )
  const hasSales = slices.some((slice) => slice.skuCount > 0)

  function showSkuMode () {
    setMode('sku')
  }

  function showProductMode () {
    setMode('product')
  }

  return (
    <main className='space-y-4'>
      <h1 className='text-2xl font-semibold'>Curva ABC</h1>
      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]'>
        <section className='rounded-lg border bg-card p-4'>
          <h2 className='text-sm font-medium'>Gráfico da Curva ABC</h2>
          {hasSales ? (
            <>
              <div className='mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground'>
                {slices.map((slice) => (
                  <span key={slice.className} className='inline-flex items-center gap-1.5'>
                    <span className='h-2.5 w-2.5 rounded-sm' style={{ backgroundColor: CLASS_COLOR[slice.className] }} />
                    {CLASS_LABEL[slice.className]}
                  </span>
                ))}
              </div>
              <AbcPie slices={slices} />
            </>
          ) : (
            <p className='py-16 text-center text-sm text-muted-foreground'>
              Nenhuma venda paga de produto para classificar.
            </p>
          )}
        </section>
        <div className='grid gap-3'>
          {slices.map((slice) => (
            <section key={slice.className} className='flex items-center gap-3 rounded-lg border bg-card p-4'>
              <Tag className='h-5 w-5 shrink-0' style={{ color: CLASS_COLOR[slice.className] }} aria-hidden />
              <div>
                <p className='text-sm font-medium'>{CLASS_LABEL[slice.className]}</p>
                <p className='text-sm text-muted-foreground'>
                  {slice.skuCount}
                  {' '}
                  {slice.skuCount === 1 ? 'SKU' : 'SKUs'}
                </p>
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'>
        <section className='rounded-lg border bg-card p-4'>
          <h2 className='flex items-center gap-2 text-sm font-medium'>
            <PieChart className='h-4 w-4' aria-hidden />
            Curva ABC
          </h2>
          <div className='mt-2'>
            {slices.map((slice) => (
              <AbcCurveList key={slice.className} slice={slice} />
            ))}
          </div>
        </section>
        <div className='inline-flex rounded-full border bg-card p-1' role='group' aria-label='Agrupar a curva'>
          <button
            type='button'
            onClick={showSkuMode}
            className={`rounded-full px-3 py-1.5 text-sm ${mode === 'sku' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            aria-pressed={mode === 'sku'}
          >
            Variações + Simples + Composições
          </button>
          <button
            type='button'
            onClick={showProductMode}
            className={`rounded-full px-3 py-1.5 text-sm ${mode === 'product' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            aria-pressed={mode === 'product'}
          >
            Produtos
          </button>
        </div>
      </div>
    </main>
  )
}
