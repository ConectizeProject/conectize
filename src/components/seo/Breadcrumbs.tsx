import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import type { BreadcrumbItem } from '@/lib/types/seo'
import { getSiteUrl } from '@/lib/utils/site-url'

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

function toAbsoluteUrl (href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  const base = getSiteUrl()
  return href.startsWith('/') ? `${base}${href}` : `${base}/${href}`
}

export function getBreadcrumbJsonLd (items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: toAbsoluteUrl(item.href),
    })),
  }
}

export function Breadcrumbs ({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null

  const jsonLd = getBreadcrumbJsonLd(items)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          {items.map((item, index) => (
            <li key={`${item.href}-${item.label}`} className="flex items-center gap-2">
              {index === 0 && <Home className="w-4 h-4" />}
              {index < items.length - 1 ? (
                <>
                  <Link
                    href={item.href}
                    className="hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
