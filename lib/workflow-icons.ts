import type { LucideIcon } from 'lucide-react'
import {
  Zap,
  Rocket,
  Star,
  Play,
  Users,
  Package,
  AlertTriangle,
  Clock,
  Shield,
  Flag,
  Target,
  Layers,
  Sparkles,
  CheckCircle2,
  GitMerge,
  RefreshCw,
  ArrowRight,
  Flame,
  Bolt,
  Send,
} from 'lucide-react'

export const WORKFLOW_ICON_MAP: Record<string, LucideIcon> = {
  Zap,
  Rocket,
  Star,
  Play,
  Users,
  Package,
  AlertTriangle,
  Clock,
  Shield,
  Flag,
  Target,
  Layers,
  Sparkles,
  CheckCircle2,
  GitMerge,
  RefreshCw,
  ArrowRight,
  Flame,
  Bolt,
  Send,
}

export const WORKFLOW_ICON_OPTIONS = Object.entries(WORKFLOW_ICON_MAP).map(
  ([name, Icon]) => ({ name, Icon }),
)

export const WORKFLOW_COLOR_OPTIONS = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#64748b', // slate
]

export const DEFAULT_WORKFLOW_ICON = 'Zap'
export const DEFAULT_WORKFLOW_COLOR = '#6366f1'

export function getWorkflowIcon(name: string): LucideIcon {
  return WORKFLOW_ICON_MAP[name] ?? Zap
}
