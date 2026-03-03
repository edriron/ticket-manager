import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function TicketDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-md shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="space-y-4 min-w-0">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>

          {/* Comments card */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex border-b">
                <Skeleton className="h-8 w-32 mb-0.5" />
                <Skeleton className="h-8 w-28 ml-2 mb-0.5" />
              </div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              {['Status', 'Priority', 'Requester', 'Assignee', 'Created'].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  {i < 4 && <Separator className="mt-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
