'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { commentSchema, type CommentFormValues } from '@/lib/validations'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/layout/user-avatar'
import { formatRelativeTime, formatDateTime } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Trash2, Pencil } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { TicketComment, ActivityLog, Profile } from '@/types'
import { useRouter } from 'next/navigation'

interface CommentSectionProps {
  ticketId: string
  comments: TicketComment[]
  activityLogs: ActivityLog[]
  currentUser: Profile
}

function ActivityItem({ log }: { log: ActivityLog }) {
  const user = log.user as Profile | null
  const actionText = () => {
    if (log.action === 'created') return 'created this ticket'
    if (log.action === 'updated') {
      if (log.field === 'status') return `changed status from "${log.old_value}" to "${log.new_value}"`
      if (log.field === 'assignee') return `updated the assignee`
      if (log.field === 'priority') return `changed priority to "${log.new_value}"`
      return 'updated this ticket'
    }
    return log.action
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <UserAvatar displayName={user?.display_name} avatarUrl={user?.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <span className="text-sm">
          <span className="font-medium">{user?.display_name ?? 'Someone'}</span>{' '}
          <span className="text-muted-foreground">{actionText()}</span>
        </span>
        <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(log.created_at)}</p>
      </div>
    </div>
  )
}

interface CommentItemProps {
  comment: TicketComment
  currentUserId: string
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
}

function CommentItem({ comment, currentUserId, onDelete, onEdit }: CommentItemProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const user = comment.user as Profile | null
  const isOwner = comment.user_id === currentUserId

  async function handleSave() {
    if (!editContent.trim()) return
    setSaving(true)
    await onEdit(comment.id, editContent)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="flex items-start gap-3 py-3 group">
      <UserAvatar displayName={user?.display_name} avatarUrl={user?.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{user?.display_name ?? 'User'}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-default">
                {formatRelativeTime(comment.created_at)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{formatDateTime(comment.created_at)}</TooltipContent>
          </Tooltip>
          {comment.updated_at !== comment.created_at && (
            <span className="text-xs text-muted-foreground italic">(edited)</span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>

      {isOwner && !editing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(comment.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

export function CommentSection({
  ticketId,
  comments: initialComments,
  activityLogs,
  currentUser,
}: CommentSectionProps) {
  const [comments, setComments] = useState<TicketComment[]>(initialComments)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')
  const supabase = createClient()
  const router = useRouter()

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: '' },
  })

  async function onSubmit(values: CommentFormValues) {
    setSubmitting(true)
    const { data, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        user_id: currentUser.id,
        content: values.content,
      })
      .select('*, user:profiles!ticket_comments_user_id_fkey(*)')
      .single()

    if (error) {
      toast.error('Failed to post comment')
      setSubmitting(false)
      return
    }

    setComments((prev) => [...prev, data as TicketComment])
    form.reset()
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('ticket_comments')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete comment')
      return
    }
    setComments((prev) => prev.filter((c) => c.id !== id))
    toast.success('Comment deleted')
  }

  async function handleEdit(id: string, content: string) {
    const { error } = await supabase
      .from('ticket_comments')
      .update({ content })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update comment')
      return
    }
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, content, updated_at: new Date().toISOString() } : c))
    )
    toast.success('Comment updated')
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('comments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'comments'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Comments ({comments.length})
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'activity'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Activity ({activityLogs.length})
        </button>
      </div>

      {activeTab === 'comments' && (
        <>
          {/* Comment list */}
          <div className="divide-y">
            {comments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUser.id}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))
            )}
          </div>

          <Separator />

          {/* New comment form */}
          <div className="flex gap-3">
            <UserAvatar
              displayName={currentUser.display_name}
              avatarUrl={currentUser.avatar_url}
              size="sm"
              className="mt-1 shrink-0"
            />
            <div className="flex-1">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Leave a comment..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? 'Posting...' : 'Post comment'}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </>
      )}

      {activeTab === 'activity' && (
        <div className="divide-y">
          {activityLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            activityLogs.map((log) => <ActivityItem key={log.id} log={log} />)
          )}
        </div>
      )}
    </div>
  )
}
