import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types'
import { TICKET_STATUS_LABELS } from '@/types'
import { Circle, Clock, PauseCircle, FlaskConical, CheckCircle2 } from 'lucide-react'

const statusIconColors: Record<TicketStatus, string> = {
  todo: 'text-slate-400',
  in_progress: 'text-sky-500',
  pending: 'text-amber-500',
  in_testing: 'text-purple-500',
  done: 'text-green-500',
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
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <Icon className={cn('h-3 w-3', statusIconColors[status])} />
      {TICKET_STATUS_LABELS[status]}
    </span>
  )
}
