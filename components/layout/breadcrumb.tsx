'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  app: 'Dashboard',
  streams: 'Streams',
  create: 'Create Stream',
  analytics: 'Analytics',
  stream: 'Stream',
  batch: 'Batch',
}

function buildCrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href: string }[] = []
  let path = ''

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    path += `/${seg}`

    // Skip the bare "app" segment — Dashboard link comes from /app
    if (seg === 'app' && i === 0) {
      crumbs.push({ label: 'Dashboard', href: '/app' })
      continue
    }

    const label = SEGMENT_LABELS[seg] ?? `Stream #${seg}`
    crumbs.push({ label, href: path })
  }

  return crumbs
}

export function Breadcrumb() {
  const pathname = usePathname()

  // Only render on nested pages (not the dashboard root itself)
  if (pathname === '/app') return null

  const crumbs = buildCrumbs(pathname)
  if (crumbs.length <= 1) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b border-border bg-background/60 px-4 sm:px-6"
    >
      <ol className="mx-auto flex h-9 max-w-6xl items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              {isLast ? (
                <span
                  className="max-w-[120px] truncate font-medium text-foreground sm:max-w-none"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="max-w-[80px] truncate text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded sm:max-w-none"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
