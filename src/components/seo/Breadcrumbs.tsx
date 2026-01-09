import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import type { BreadcrumbItem } from '@/lib/types/seo'

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs ({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
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
  )
}


