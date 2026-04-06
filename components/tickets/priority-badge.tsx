import { cn } from '@/lib/utils'
import type { TicketPriority } from '@/types'
import { TICKET_PRIORITY_LABELS } from '@/types'
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react'

const priorityIconColors: Record<TicketPriority, string> = {
  low: 'text-slate-400',
  medium: 'text-orange-400',
  high: 'text-red-500',
  critical: 'text-red-600',
}

const priorityIcons: Record<TicketPriority, React.ComponentType<{ className?: string }>> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  critical: AlertTriangle,
}

interface PriorityBadgeProps {
  priority: TicketPriority
  className?: string
  showIcon?: boolean
}

export function PriorityBadge({ priority, className, showIcon = true }: PriorityBadgeProps) {
  const Icon = priorityIcons[priority]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      {showIcon && <Icon className={cn('h-3 w-3', priorityIconColors[priority])} />}
      {TICKET_PRIORITY_LABELS[priority]}
    </span>
  )
}
