import Link from 'next/link'
import { Waves, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyStreams({
  title = 'No streams yet',
  description = 'Create your first stream to start sending tokens that unlock in real time.',
  showCreate = true,
}: {
  title?: string
  description?: string
  showCreate?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
        <Waves className="size-6" />
      </span>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">{description}</p>
      {showCreate && (
        <Button asChild className="mt-5 gap-1.5">
          <Link href="/app/create">
            <Plus className="size-4" />
            Create a stream
          </Link>
        </Button>
      )}
    </div>
  )
}
