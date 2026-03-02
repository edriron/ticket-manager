import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TicketPriority } from '@/types'
import { TICKET_PRIORITY_LABELS } from '@/types'
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from 'lucide-react'

const priorityStyles: Record<TicketPriority, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  medium: 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  high: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  critical: 'bg-red-200 text-red-800 border-red-400 dark:bg-red-900/60 dark:text-red-200 dark:border-red-700',
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
    <Badge
      variant="outline"
      className={cn('font-medium text-xs gap-1', priorityStyles[priority], className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {TICKET_PRIORITY_LABELS[priority]}
    </Badge>
  )
}
