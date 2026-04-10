'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Zap } from 'lucide-react'
import {
  getWorkflowIcon,
  DEFAULT_WORKFLOW_ICON,
  DEFAULT_WORKFLOW_COLOR,
} from '@/lib/workflow-icons'
import type { TicketWorkflow } from '@/types'

interface WorkflowButtonProps {
  userId: string
  onApply: (workflow: TicketWorkflow) => Promise<void>
  disabled?: boolean
}

export function WorkflowButton({ userId, onApply, disabled }: WorkflowButtonProps) {
  const supabase = createClient()
  const [workflows, setWorkflows] = useState<TicketWorkflow[]>([])
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    supabase
      .from('ticket_workflows')
      .select()
      .eq('user_id', userId)
      .order('sort_order')
      .then(({ data }) => setWorkflows((data as TicketWorkflow[]) ?? []))
  }, [userId])

  if (workflows.length === 0) return null

  async function handleSelect(workflow: TicketWorkflow) {
    setApplying(true)
    await onApply(workflow)
    setApplying(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || applying}
        >
          <Zap className="h-3.5 w-3.5" />
          {applying ? 'Applying…' : 'Workflows'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1">
        {workflows.map((w) => {
          const Icon = getWorkflowIcon(w.icon ?? DEFAULT_WORKFLOW_ICON)
          const col = w.icon_color ?? DEFAULT_WORKFLOW_COLOR
          return (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => handleSelect(w)}
              className="flex items-center gap-2.5 py-2 cursor-pointer"
            >
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: col + '22' }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: col }} />
              </div>
              <span className="text-sm font-medium">{w.name}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
