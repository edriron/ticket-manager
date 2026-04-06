import { cn } from '@/lib/utils'
import type { TicketType } from '@/types'
import { TICKET_TYPE_LABELS } from '@/types'
import { Bug, Sparkles } from 'lucide-react'

const typeIconColors: Record<TicketType, string> = {
  bug: 'text-rose-500',
  feature_request: 'text-violet-500',
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
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      {showIcon && <Icon className={cn('h-3 w-3', typeIconColors[type])} />}
      {TICKET_TYPE_LABELS[type]}
    </span>
  )
}
