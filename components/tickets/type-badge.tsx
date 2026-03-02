import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TicketType } from '@/types'
import { TICKET_TYPE_LABELS } from '@/types'
import { Bug, Sparkles } from 'lucide-react'

const typeStyles: Record<TicketType, string> = {
  bug: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  feature_request: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
}

const typeIcons: Record<TicketType, React.ComponentType<{ className?: string }>> = {
  bug: Bug,
  feature_request: Sparkles,
}

interface TypeBadgeProps {
  type: TicketType
  className?: string
  showIcon?: boolean
}

export function TypeBadge({ type, className, showIcon = true }: TypeBadgeProps) {
  const Icon = typeIcons[type]

  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-xs gap-1', typeStyles[type], className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {TICKET_TYPE_LABELS[type]}
    </Badge>
  )
}
