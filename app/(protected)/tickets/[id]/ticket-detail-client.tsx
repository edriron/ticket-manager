'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, ExternalLink, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TypeBadge } from '@/components/tickets/type-badge'
import { StatusBadge } from '@/components/tickets/status-badge'
import { PriorityBadge } from '@/components/tickets/priority-badge'
import { UserAvatar } from '@/components/layout/user-avatar'
import { CommentSection } from '@/components/tickets/comment-section'
import { TicketForm } from '@/components/tickets/ticket-form'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Check } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Ticket, TicketComment, ActivityLog, Profile, TicketStatus, TicketPriority } from '@/types'
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS, TICKET_STATUS_ORDER } from '@/types'
import { cn } from '@/lib/utils'

interface TicketDetailClientProps {
  ticket: Ticket
  comments: TicketComment[]
  activityLogs: ActivityLog[]
  currentUser: Profile
}

export function TicketDetailClient({
  ticket,
  comments,
  activityLogs,
  currentUser,
}: TicketDetailClientProps) {
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority)
  const [assigneeId, setAssigneeId] = useState<string | null>(ticket.assignee_id)
  const [assigneeProfile, setAssigneeProfile] = useState<Profile | null>(
    ticket.assignee as Profile | null
  )
  const [savingField, setSavingField] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [userResults, setUserResults] = useState<Profile[]>([])

  const requester = ticket.requester as Profile | null
  const supabase = createClient()
  const router = useRouter()

  function notifyUsers(title: string, body: string, excludeForAssigneeId?: string | null) {
    // Notify requester + assignee, excluding the current user and optionally one more id
    const targetIds = [ticket.requester_id, excludeForAssigneeId ?? assigneeId]
      .filter((id): id is string => !!id && id !== currentUser.id)
    if (!targetIds.length) return
    supabase.from('notifications').insert(
      targetIds.map((user_id) => ({ user_id, title, body, ticket_id: ticket.id }))
    ).then()
  }

  async function updateField(field: string, value: string | null, displayValue?: string) {
    setSavingField(field)
    const { error } = await supabase
      .from('tickets')
      .update({ [field]: value })
      .eq('id', ticket.id)

    setSavingField(null)

    if (error) {
      return false
    }

    // Fire-and-forget: activity log doesn't need to block the UI
    supabase.from('activity_logs').insert({
      ticket_id: ticket.id,
      user_id: currentUser.id,
      action: 'updated',
      field,
      new_value: displayValue ?? value,
    }).then()

    return true
  }

  function notifyDiscordUpdate(newStatus: TicketStatus, newPriority: TicketPriority, newAssigneeName: string | null | undefined) {
    if (!ticket.discord_thread_id) return
    fetch('/api/notify-discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        ticketType: ticket.type,
        threadId: ticket.discord_thread_id,
        title: ticket.title,
        priority: newPriority,
        status: newStatus,
        assignee: newAssigneeName ?? null,
        updatedBy: currentUser.display_name,
      }),
    }).catch(() => {})
  }

  async function handleStatusChange(newStatus: TicketStatus) {
    const prev = status
    setStatus(newStatus) // optimistic
    const ok = await updateField('status', newStatus, TICKET_STATUS_LABELS[newStatus])
    if (ok) {
      toast.success(`Status → ${TICKET_STATUS_LABELS[newStatus]}`)
      notifyDiscordUpdate(newStatus, priority, assigneeProfile?.display_name)
      notifyUsers(
        `Ticket #${ticket.ticket_number} status changed`,
        `"${ticket.title}" → ${TICKET_STATUS_LABELS[newStatus]}`,
      )
    } else {
      setStatus(prev) // rollback
      toast.error('Failed to update status')
    }
  }

  async function handlePriorityChange(newPriority: TicketPriority) {
    const prev = priority
    setPriority(newPriority) // optimistic
    const ok = await updateField('priority', newPriority, TICKET_PRIORITY_LABELS[newPriority])
    if (ok) {
      toast.success(`Priority → ${TICKET_PRIORITY_LABELS[newPriority]}`)
      notifyDiscordUpdate(status, newPriority, assigneeProfile?.display_name)
      notifyUsers(
        `Ticket #${ticket.ticket_number} priority changed`,
        `"${ticket.title}" → ${TICKET_PRIORITY_LABELS[newPriority]}`,
      )
    } else {
      setPriority(prev) // rollback
      toast.error('Failed to update priority')
    }
  }

  async function handleAssigneeChange(newAssigneeId: string | null) {
    const prevId = assigneeId
    const prevProfile = assigneeProfile
    // Optimistic: use profile already available in search results
    const optimisticProfile = newAssigneeId
      ? (userResults.find((u) => u.id === newAssigneeId) ?? null)
      : null
    setAssigneeId(newAssigneeId)
    setAssigneeProfile(optimisticProfile)

    const ok = await updateField('assignee_id', newAssigneeId)
    if (ok) {
      toast.success(newAssigneeId ? 'Assignee updated' : 'Assignee removed')
      notifyDiscordUpdate(status, priority, optimisticProfile?.display_name ?? null)
      // Notify the new assignee (if not current user)
      if (newAssigneeId && newAssigneeId !== currentUser.id) {
        supabase.from('notifications').insert({
          user_id: newAssigneeId,
          title: `You were assigned to ticket #${ticket.ticket_number}`,
          body: ticket.title,
          ticket_id: ticket.id,
        }).then()
      }
      // Notify requester about the assignee change (excluding new assignee to avoid double)
      notifyUsers(
        `Ticket #${ticket.ticket_number} assignee changed`,
        `"${ticket.title}" assigned to ${optimisticProfile?.display_name ?? 'nobody'}`,
        newAssigneeId,
      )
    } else {
      setAssigneeId(prevId) // rollback
      setAssigneeProfile(prevProfile)
      toast.error('Failed to update assignee')
    }
  }

  async function searchUsers(query: string) {
    const q = supabase.from('profiles').select('*').not('display_name', 'is', null).limit(10)
    if (query) q.or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
    const { data } = await q
    setUserResults((data as Profile[]) ?? [])
  }

  async function handleDelete() {
    setDeleting(true)

    // Post deletion notice to Discord thread and archive it
    if (ticket.discord_thread_id) {
      fetch('/api/notify-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ticketType: ticket.type,
          threadId: ticket.discord_thread_id,
        }),
      }).catch(() => {})
    }

    const { error } = await supabase.from('tickets').delete().eq('id', ticket.id)

    if (error) {
      toast.error('Failed to delete ticket', { description: error.message })
      setDeleting(false)
      return
    }

    toast.success('Ticket deleted')
    router.push('/tickets')
    router.refresh()
  }

  const priorities: TicketPriority[] = ['critical', 'high', 'medium', 'low']

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 mt-0.5 shrink-0">
          <Link href="/tickets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground font-medium">
              #{ticket.ticket_number}
            </span>
            <TypeBadge type={ticket.type} />
            <StatusBadge status={status} />
            <PriorityBadge priority={priority} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">{ticket.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Opened{' '}
            <Tooltip>
              <TooltipTrigger className="cursor-default">
                {formatRelativeTime(ticket.created_at)}
              </TooltipTrigger>
              <TooltipContent>{formatDateTime(ticket.created_at)}</TooltipContent>
            </Tooltip>
            {' '}by{' '}
            <span className="font-medium text-foreground">{requester?.display_name ?? 'Unknown'}</span>
            {ticket.updated_at !== ticket.created_at && (
              <> · Updated{' '}
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    {formatRelativeTime(ticket.updated_at)}
                  </TooltipTrigger>
                  <TooltipContent>{formatDateTime(ticket.updated_at)}</TooltipContent>
                </Tooltip>
              </>
            )}
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1.5" disabled={deleting}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete ticket #{ticket.ticket_number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the ticket, all its comments, attachments, and
                    activity history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete ticket
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="space-y-4 min-w-0">
          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit Ticket</CardTitle>
              </CardHeader>
              <CardContent>
                <TicketForm
                  mode="edit"
                  ticket={{ ...ticket, status, priority, assignee_id: assigneeId }}
                  currentUserId={currentUser.id}
                  currentUserName={currentUser.display_name ?? undefined}
                  onCancel={() => setEditing(false)}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-5">
                {ticket.description ? (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Description</h3>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {ticket.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description provided.</p>
                )}

                {ticket.type === 'bug' && (
                  ticket.steps_to_reproduce || ticket.expected_behavior || ticket.actual_behavior
                ) && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      {ticket.steps_to_reproduce && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">Steps to Reproduce</h3>
                          <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                            {ticket.steps_to_reproduce}
                          </p>
                        </div>
                      )}
                      {(ticket.expected_behavior || ticket.actual_behavior) && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          {ticket.expected_behavior && (
                            <div>
                              <h3 className="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">
                                Expected Behavior
                              </h3>
                              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                                {ticket.expected_behavior}
                              </p>
                            </div>
                          )}
                          {ticket.actual_behavior && (
                            <div>
                              <h3 className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">
                                Actual Behavior
                              </h3>
                              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                                {ticket.actual_behavior}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {ticket.environment_url && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Environment</h3>
                      <a
                        href={ticket.environment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {ticket.environment_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </>
                )}

                {ticket.attachments && ticket.attachments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Attachments ({ticket.attachments.length})
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {ticket.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                          >
                            <div className="aspect-video relative bg-muted">
                              <Image
                                src={attachment.url}
                                alt={attachment.filename}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, 33vw"
                              />
                            </div>
                            <div className="p-2 bg-background">
                              <p className="text-xs truncate text-muted-foreground">
                                {attachment.filename}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {!editing && (
            <Card>
              <CardContent className="pt-6">
                <CommentSection
                  ticketId={ticket.id}
                  comments={comments}
                  activityLogs={activityLogs}
                  currentUser={currentUser}
                  discordThreadId={ticket.discord_thread_id}
                  ticketType={ticket.type}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — inline-editable fields */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">

                {/* Status — clickable dropdown */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Status
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 group"
                        disabled={savingField === 'status'}
                      >
                        <StatusBadge status={status} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      {TICKET_STATUS_ORDER.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          onSelect={() => handleStatusChange(s)}
                          className="gap-2"
                        >
                          <StatusBadge status={s} />
                          {s === status && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Separator />

                {/* Priority — clickable dropdown */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Priority
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 group"
                        disabled={savingField === 'priority'}
                      >
                        <PriorityBadge priority={priority} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      {priorities.map((p) => (
                        <DropdownMenuItem
                          key={p}
                          onSelect={() => handlePriorityChange(p)}
                          className="gap-2"
                        >
                          <PriorityBadge priority={p} />
                          {p === priority && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Separator />

                {/* Requester — read-only */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Requester
                  </p>
                  {requester ? (
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        displayName={requester.display_name}
                        avatarUrl={requester.avatar_url}
                        size="sm"
                      />
                      <span className="text-sm">{requester.display_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unknown</span>
                  )}
                </div>

                <Separator />

                {/* Assignee — plain text display, click to open search */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Assignee
                  </p>
                  <Popover
                    open={assigneeOpen}
                    onOpenChange={(o) => { setAssigneeOpen(o); if (o) searchUsers('') }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center gap-2 w-full text-left group rounded hover:bg-muted/50 -mx-1 px-1 py-0.5 transition-colors"
                        disabled={savingField === 'assignee_id'}
                      >
                        {assigneeProfile ? (
                          <>
                            <UserAvatar
                              displayName={assigneeProfile.display_name}
                              avatarUrl={assigneeProfile.avatar_url}
                              size="sm"
                            />
                            <span className="text-sm">{assigneeProfile.display_name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search by name or email..."
                          onValueChange={searchUsers}
                        />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            {/* Unassign option */}
                            <CommandItem
                              onSelect={() => {
                                handleAssigneeChange(null)
                                setAssigneeOpen(false)
                              }}
                              className="gap-2 text-muted-foreground"
                            >
                              <span className="text-sm">Unassigned</span>
                              {!assigneeId && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                            {userResults.map((u) => (
                              <CommandItem
                                key={u.id}
                                value={u.id}
                                onSelect={() => {
                                  handleAssigneeChange(u.id)
                                  setAssigneeOpen(false)
                                }}
                                className="gap-2"
                              >
                                <UserAvatar
                                  displayName={u.display_name}
                                  avatarUrl={u.avatar_url}
                                  size="sm"
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium">{u.display_name}</span>
                                  {u.email && (
                                    <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                                  )}
                                </div>
                                {assigneeId === u.id && (
                                  <Check className={cn('ml-auto h-4 w-4 shrink-0')} />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator />

                {/* Created */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Created
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground cursor-default">
                        {formatDate(ticket.created_at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{formatDateTime(ticket.created_at)}</TooltipContent>
                  </Tooltip>
                </div>

                {ticket.updated_at !== ticket.created_at && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        Last Updated
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground cursor-default">
                            {formatDate(ticket.updated_at)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{formatDateTime(ticket.updated_at)}</TooltipContent>
                      </Tooltip>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
