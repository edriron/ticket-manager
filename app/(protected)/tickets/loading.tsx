import { Skeleton } from '@/components/ui/skeleton'

export default function TicketsLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Filter bar */}
      <Skeleton className="h-10 w-full rounded-md" />

      {/* Desktop table */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="bg-muted/50 border-b px-4 py-3 flex items-center gap-4">
          <Skeleton className="h-4 w-8 shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 w-24 shrink-0" />
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
        {/* Data rows */}
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-8 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-28 rounded-full shrink-0" />
              <Skeleton className="h-5 w-24 rounded-full shrink-0" />
              <Skeleton className="h-5 w-20 rounded-full shrink-0" />
              <div className="flex items-center gap-2 w-28 shrink-0">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex items-center gap-2 w-28 shrink-0">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
