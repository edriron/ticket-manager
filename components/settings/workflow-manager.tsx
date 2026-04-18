'use client'

import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Zap,
  Check,
  ArrowRight,
  CircleDot,
  BarChart2,
  UserRound,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { StatusBadge } from '@/components/tickets/status-badge'
import { PriorityBadge } from '@/components/tickets/priority-badge'
import { UserAvatar } from '@/components/layout/user-avatar'
import { cn } from '@/lib/utils'
import {
  WORKFLOW_ICON_OPTIONS,
  WORKFLOW_COLOR_OPTIONS,
  DEFAULT_WORKFLOW_ICON,
  DEFAULT_WORKFLOW_COLOR,
  getWorkflowIcon,
} from '@/lib/workflow-icons'
import type {
  TicketWorkflow,
  WorkflowStep,
  WorkflowStepType,
  TicketStatus,
  TicketPriority,
  Profile,
} from '@/types'
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_ORDER,
} from '@/types'

// ─── Step type config ─────────────────────────────────────────────────────────

const STEP_TYPES: {
  type: WorkflowStepType
  label: string
  icon: React.ElementType
  color: string
}[] = [
  { type: 'status', label: 'Status', icon: CircleDot, color: 'text-sky-500' },
  { type: 'priority', label: 'Priority', icon: BarChart2, color: 'text-orange-500' },
  { type: 'assignee', label: 'Assign', icon: UserRound, color: 'text-violet-500' },
  { type: 'comment', label: 'Comment', icon: MessageCircle, color: 'text-emerald-500' },
]

const PRIORITY_ORDER: TicketPriority[] = ['critical', 'high', 'medium', 'low']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stepLabel(step: WorkflowStep, profiles: Profile[]): string {
  if (step.type === 'status')
    return TICKET_STATUS_LABELS[step.value as TicketStatus] ?? '?'
  if (step.type === 'priority')
    return TICKET_PRIORITY_LABELS[step.value as TicketPriority] ?? '?'
  if (step.type === 'assignee') {
    if (!step.value) return 'Unassigned'
    return profiles.find((p) => p.id === step.value)?.display_name ?? 'Unknown'
  }
  if (step.type === 'comment')
    return `"${(step.value ?? '').slice(0, 28)}${(step.value?.length ?? 0) > 28 ? '…' : ''}"`
  return '?'
}

// ─── Step row (inside dialog) ─────────────────────────────────────────────────

interface StepRowProps {
  step: WorkflowStep
  index: number
  total: number
  profiles: Profile[]
  onChange: (index: number, step: WorkflowStep) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}

function StepRow({
  step,
  index,
  total,
  profiles,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepRowProps) {
  const [typeOpen, setTypeOpen] = useState(false)
  const [valueOpen, setValueOpen] = useState(false)

  const typeConfig = STEP_TYPES.find((t) => t.type === step.type)!
  const TypeIcon = typeConfig.icon

  function changeType(type: WorkflowStepType) {
    onChange(index, { type, value: null })
    setTypeOpen(false)
  }

  function changeValue(value: string | null) {
    onChange(index, { ...step, value })
    setValueOpen(false)
  }

  return (
    <div className="flex items-center gap-2 group/row">
      {/* Reorder */}
      <div className="flex flex-col gap-0 shrink-0">
        <button
          type="button"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(index)}
          disabled={index === total - 1}
          className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border/60 bg-card hover:border-border transition-colors">
        {/* Type pill */}
        <Popover open={typeOpen} onOpenChange={setTypeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-xs font-medium transition-colors shrink-0',
                typeConfig.color,
              )}
            >
              <TypeIcon className="h-3.5 w-3.5" />
              <span className="text-foreground">{typeConfig.label}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="start">
            {STEP_TYPES.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                type="button"
                onClick={() => changeType(type)}
                className="flex items-center gap-2 w-full px-2.5 py-2 rounded-md hover:bg-muted text-sm transition-colors"
              >
                <Icon className={cn('h-4 w-4', color)} />
                <span>{label}</span>
                {type === step.type && <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Arrow */}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />

        {/* Value */}
        <div className="flex-1 min-w-0">
          {/* Status */}
          {step.type === 'status' && (
            <Popover open={valueOpen} onOpenChange={setValueOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="hover:opacity-75 transition-opacity">
                  {step.value ? (
                    <StatusBadge status={step.value as TicketStatus} />
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">Pick status…</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {TICKET_STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeValue(s)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <StatusBadge status={s} />
                    {s === step.value && <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}

          {/* Priority */}
          {step.type === 'priority' && (
            <Popover open={valueOpen} onOpenChange={setValueOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="hover:opacity-75 transition-opacity">
                  {step.value ? (
                    <PriorityBadge priority={step.value as TicketPriority} />
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">Pick priority…</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="start">
                {PRIORITY_ORDER.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => changeValue(p)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <PriorityBadge priority={p} />
                    {p === step.value && <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}

          {/* Assignee */}
          {step.type === 'assignee' && (
            <Popover open={valueOpen} onOpenChange={setValueOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 hover:opacity-75 transition-opacity">
                  {step.value ? (
                    (() => {
                      const p = profiles.find((pr) => pr.id === step.value)
                      return p ? (
                        <>
                          <UserAvatar displayName={p.display_name} avatarUrl={p.avatar_url} size="sm" />
                          <span className="text-xs font-medium">{p.display_name ?? p.email}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">Unknown user</span>
                      )
                    })()
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">Pick assignee…</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search users…" />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__unassign__"
                        onSelect={() => changeValue(null)}
                        className="gap-2"
                      >
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                        {step.value === null && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </CommandItem>
                      {profiles.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.display_name ?? p.email ?? p.id}
                          onSelect={() => changeValue(p.id)}
                          className="gap-2"
                        >
                          <UserAvatar displayName={p.display_name} avatarUrl={p.avatar_url} size="sm" />
                          <span className="text-sm">{p.display_name ?? p.email}</span>
                          {p.id === step.value && <Check className="h-3.5 w-3.5 ml-auto" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {/* Comment — inline input, no popover needed */}
          {step.type === 'comment' && (
            <input
              type="text"
              value={step.value ?? ''}
              onChange={(e) => onChange(index, { ...step, value: e.target.value || null })}
              placeholder="Type a comment…"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 text-foreground"
            />
          )}
        </div>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/0 group-hover/row:text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Icon + color picker ──────────────────────────────────────────────────────

interface IconPickerProps {
  icon: string
  color: string
  onIconChange: (icon: string) => void
  onColorChange: (color: string) => void
}

function IconPicker({ icon, color, onIconChange, onColorChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const Icon = getWorkflowIcon(icon)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-10 w-10 rounded-xl flex items-center justify-center border-2 transition-colors hover:opacity-90 shrink-0"
          style={{
            backgroundColor: color + '22',
            borderColor: color + '55',
          }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-3" align="start">
        {/* Icon grid */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Icon</p>
          <div className="grid grid-cols-5 gap-1">
            {WORKFLOW_ICON_OPTIONS.map(({ name, Icon: Ic }) => (
              <button
                key={name}
                type="button"
                onClick={() => onIconChange(name)}
                className={cn(
                  'p-1.5 rounded-lg flex items-center justify-center transition-colors hover:bg-muted',
                  icon === name && 'bg-muted ring-1 ring-ring',
                )}
              >
                <Ic className="h-4 w-4" style={{ color }} />
              </button>
            ))}
          </div>
        </div>

        {/* Color swatches */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Color</p>
          <div className="grid grid-cols-6 gap-1.5">
            {WORKFLOW_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                  color === c ? 'border-foreground scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Workflow dialog ──────────────────────────────────────────────────────────

interface WorkflowDialogProps {
  open: boolean
  editing: TicketWorkflow | null
  profiles: Profile[]
  userId: string
  existingCount: number
  onSaved: (workflow: TicketWorkflow) => void
  onClose: () => void
}

function WorkflowDialog({
  open,
  editing,
  profiles,
  userId,
  existingCount,
  onSaved,
  onClose,
}: WorkflowDialogProps) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [icon, setIcon] = useState(DEFAULT_WORKFLOW_ICON)
  const [color, setColor] = useState(DEFAULT_WORKFLOW_COLOR)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setSteps(editing?.steps ?? [])
      setIcon(editing?.icon ?? DEFAULT_WORKFLOW_ICON)
      setColor(editing?.icon_color ?? DEFAULT_WORKFLOW_COLOR)
    }
  }, [open, editing])

  function addStep() {
    setSteps((prev) => [...prev, { type: 'status', value: null }])
  }

  function handleStepChange(index: number, step: WorkflowStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? step : s)))
  }

  function handleRemoveStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMoveUp(index: number) {
    if (index === 0) return
    setSteps((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function handleMoveDown(index: number) {
    setSteps((prev) => {
      if (index === prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Give this workflow a name'); return }
    if (steps.length === 0) { toast.error('Add at least one step'); return }
    const invalid = steps.find(
      (s) =>
        (s.type !== 'assignee' && !s.value) ||
        (s.type === 'comment' && !s.value?.trim()),
    )
    if (invalid) { toast.error('All steps need a value'); return }

    setSaving(true)
    const payload = {
      name: name.trim(),
      steps,
      icon,
      icon_color: color,
      updated_at: new Date().toISOString(),
    }

    if (editing) {
      const { data, error } = await supabase
        .from('ticket_workflows')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single()
      setSaving(false)
      if (error) { toast.error('Failed to save'); return }
      toast.success('Workflow updated')
      onSaved(data as unknown as TicketWorkflow)
    } else {
      const { data, error } = await supabase
        .from('ticket_workflows')
        .insert({ user_id: userId, sort_order: existingCount, ...payload })
        .select()
        .single()
      setSaving(false)
      if (error) { toast.error('Failed to create'); return }
      toast.success('Workflow created')
      onSaved(data as unknown as TicketWorkflow)
    }
  }

  const WorkflowIc = getWorkflowIcon(icon)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-120 max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <IconPicker icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow name…"
              className="flex-1 text-base font-semibold bg-transparent outline-none placeholder:text-muted-foreground/40 placeholder:font-normal"
              autoFocus
            />
          </DialogTitle>
        </DialogHeader>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0 min-h-0">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: color + '22' }}
              >
                <WorkflowIc className="h-5 w-5" style={{ color }} />
              </div>
              <p className="text-sm text-muted-foreground">No steps yet</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Add a step below to get started</p>
            </div>
          ) : (
            <div>
              {steps.map((step, i) => (
                <Fragment key={i}>
                  <StepRow
                    step={step}
                    index={i}
                    total={steps.length}
                    profiles={profiles}
                    onChange={handleStepChange}
                    onRemove={handleRemoveStep}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                  />
                  {i < steps.length - 1 && (
                    <div className="ml-13 h-4 border-l border-dashed border-border/60" />
                  )}
                </Fragment>
              ))}
              <div className="ml-13 h-4 border-l border-dashed border-border/40" />
            </div>
          )}

          {/* Add step */}
          <button
            type="button"
            onClick={addStep}
            className="ml-10 flex items-center gap-2 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors group/add"
          >
            <div className="h-7 w-7 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center group-hover/add:border-border transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </div>
            Add a step
          </button>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="text-muted-foreground">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: color }}>
            {saving ? 'Saving…' : editing ? 'Update workflow' : 'Create workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface WorkflowManagerProps {
  userId: string
}

export function WorkflowManager({ userId }: WorkflowManagerProps) {
  const supabase = createClient()
  const [workflows, setWorkflows] = useState<TicketWorkflow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TicketWorkflow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('ticket_workflows').select().eq('user_id', userId).order('sort_order'),
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, email, email_on_assigned, email_on_new_ticket, email_on_mention, created_at, updated_at')
        .not('display_name', 'is', null)
        .order('display_name'),
    ]).then(([{ data: w }, { data: p }]) => {
      setWorkflows((w as TicketWorkflow[]) ?? [])
      setProfiles((p as Profile[]) ?? [])
      setLoading(false)
    })
  }, [userId])

  async function handleMove(index: number, dir: -1 | 1) {
    const next = [...workflows]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setWorkflows(next.map((w, i) => ({ ...w, sort_order: i })))
    await Promise.all(
      [index, target].map((i) =>
        supabase.from('ticket_workflows').update({ sort_order: i }).eq('id', next[i].id),
      ),
    )
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('ticket_workflows').delete().eq('id', id)
    if (error) { toast.error('Failed to delete workflow'); return }
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
    toast.success('Workflow deleted')
  }

  function handleSaved(workflow: TicketWorkflow) {
    setWorkflows((prev) => {
      const idx = prev.findIndex((w) => w.id === workflow.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = workflow
        return next
      }
      return [...prev, workflow]
    })
    setDialogOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          One-click sequences of actions to apply to any ticket.
        </p>
        <Button
          size="sm"
          onClick={() => { setEditing(null); setDialogOpen(true) }}
          className="gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          New workflow
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-xl text-muted-foreground gap-2">
          <Zap className="h-7 w-7 opacity-20" />
          <p className="text-sm font-medium">No workflows yet</p>
          <p className="text-xs opacity-60">Apply multiple changes to a ticket with a single click</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map((w, i) => {
            const Icon = getWorkflowIcon(w.icon ?? DEFAULT_WORKFLOW_ICON)
            const col = w.icon_color ?? DEFAULT_WORKFLOW_COLOR
            return (
              <div key={w.id} className="flex items-center gap-3 p-3 border rounded-xl bg-card group">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(i, -1)}
                    disabled={i === 0}
                    className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(i, 1)}
                    disabled={i === workflows.length - 1}
                    className="h-5 w-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Icon */}
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: col + '22' }}
                >
                  <Icon className="h-4 w-4" style={{ color: col }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{w.name}</p>
                  {w.steps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {w.steps.map((step, si) => {
                        const tc = STEP_TYPES.find((t) => t.type === step.type)!
                        const StepIc = tc.icon
                        return (
                          <span
                            key={si}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            <StepIc className={cn('h-3 w-3', tc.color)} />
                            {stepLabel(step, profiles)}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditing(w); setDialogOpen(true) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{w.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This workflow will be permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(w.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <WorkflowDialog
        open={dialogOpen}
        editing={editing}
        profiles={profiles}
        userId={userId}
        existingCount={workflows.length}
        onSaved={handleSaved}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}
