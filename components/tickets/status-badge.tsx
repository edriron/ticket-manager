import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types'
import { TICKET_STATUS_LABELS } from '@/types'
import { Circle, Clock, PauseCircle, FlaskConical, CheckCircle2 } from 'lucide-react'

const statusStyles: Record<TicketStatus, string> = {
  todo: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  in_progress: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
  pending: 'bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
  in_testing: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
  done: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
}

const statusIcons: Record<TicketStatus, React.ComponentType<{ className?: string }>> = {
  todo: Circle,
  in_progress: Clock,
  pending: PauseCircle,
  in_testing: FlaskConical,
  done: CheckCircle2,
}

interface StatusBadgeProps {
  status: TicketStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const Icon = statusIcons[status]

  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-xs gap-1', statusStyles[status], className)}
    >
      <Icon className="h-3 w-3" />
      {TICKET_STATUS_LABELS[status]}
    </Badge>
  )
}
