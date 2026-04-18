'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ImageLightbox, useLightbox } from '@/components/ui/image-lightbox'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/layout/user-avatar'
import { formatRelativeTime, formatDateTime } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Trash2, Pencil, ImageIcon, X as XIcon, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommentEditor, CommentContent } from './comment-editor'
import type { TicketComment, ActivityLog, Profile } from '@/types'

interface CommentSectionProps {
  ticketId: string
  ticketNumber: number
  ticketTitle: string
  comments: TicketComment[]
  activityLogs: ActivityLog[]
  currentUser: Profile
  profiles: Profile[]
  discordThreadId?: string | null
  ticketType?: string
}

interface CommentAttachment { url: string; filename: string }

// ─── Activity item ────────────────────────────────────────────────────────────

function ActivityItem({ log }: { log: ActivityLog }) {
  const user = log.user as Profile | null
  const actionText = () => {
    if (log.action === 'created') return 'created this ticket'
    if (log.action === 'updated') {
      if (log.field === 'status') return `changed status from "${log.old_value ?? 'None'}" to "${log.new_value}"`
      if (log.field === 'assignee') return 'updated the assignee'
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

// ─── Comment item ─────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: TicketComment
  currentUserId: string
  profiles: Profile[]
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
}

function CommentItem({ comment, currentUserId, profiles, onDelete, onEdit }: CommentItemProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const user = comment.user as Profile | null
  const isOwner = comment.user_id === currentUserId
  const attachments = comment.attachments ?? []
  const lightbox = useLightbox()

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
            <CommentEditor
              value={editContent}
              onChange={setEditContent}
              profiles={profiles}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditContent(comment.content) }} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <CommentContent content={comment.content} />
        )}

        {/* Attached images */}
        {attachments.length > 0 && !editing && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <button
                key={i}
                type="button"
                className="group/img relative border rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                onClick={() => lightbox.openAt(attachments.map((att) => ({ url: att.url, filename: att.filename })), i)}
              >
                <div className="relative w-32 h-20">
                  <Image src={a.url} alt={a.filename} fill className="object-cover" sizes="128px" />
                </div>
              </button>
            ))}
          </div>
        )}
        <ImageLightbox {...lightbox} onClose={lightbox.close} />
      </div>

      {isOwner && !editing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(comment.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Shared upload helper ─────────────────────────────────────────────────────

async function uploadCommentImage(
  file: File,
  supabase: ReturnType<typeof createClient>,
): Promise<CommentAttachment | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'image.png'
  const path = `comments/temp/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`
  const { error } = await supabase.storage.from('ticket-attachments').upload(path, file, { contentType: file.type })
  if (error) { toast.error(`Upload failed: ${file.name}`); return null }
  const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(path)
  return { url: publicUrl, filename: file.name }
}

// ─── Compact image uploader for comments ─────────────────────────────────────

interface CommentImageUploaderProps {
  images: CommentAttachment[]
  onChange: (imgs: CommentAttachment[]) => void
  disabled?: boolean
}

function CommentImageUploader({ images, onChange, disabled }: CommentImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 5 - images.length)
    if (!arr.length) return
    setUploading(true)
    const results = await Promise.all(arr.map((f) => uploadCommentImage(f, supabase)))
    onChange([...images, ...results.filter(Boolean) as CommentAttachment[]])
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          disabled={disabled || uploading || images.length >= 5}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Add image'}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group/img border rounded-md overflow-hidden">
              <div className="relative w-20 h-14">
                <Image src={img.url} alt={img.filename} fill className="object-cover" sizes="80px" />
              </div>
              <button
                type="button"
                className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main comment section ─────────────────────────────────────────────────────

export function CommentSection({
  ticketId,
  ticketNumber,
  ticketTitle,
  comments: initialComments,
  activityLogs,
  currentUser,
  profiles,
  discordThreadId,
  ticketType,
}: CommentSectionProps) {
  const [comments, setComments] = useState<TicketComment[]>(initialComments)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')
  const [commentImages, setCommentImages] = useState<CommentAttachment[]>([])
  const [commentContent, setCommentContent] = useState('')
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const [editorKey, setEditorKey] = useState(0)
  const supabase = createClient()

  async function handleSubmit() {
    if (!commentContent.trim()) return
    setSubmitting(true)

    const { data, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        user_id: currentUser.id,
        content: commentContent,
        attachments: commentImages,
      })
      .select('*, user:profiles!ticket_comments_user_id_fkey(*)')
      .single()

    if (error) {
      toast.error('Failed to post comment')
      setSubmitting(false)
      return
    }

    setComments((prev) => [...prev, data as TicketComment])
    setCommentContent('')
    setCommentImages([])
    setMentionedIds([])
    setEditorKey((k) => k + 1)
    setSubmitting(false)

    // Notify + email mentioned users
    const targets = profiles.filter(
      (p) => mentionedIds.includes(p.id) && p.id !== currentUser.id,
    )
    for (const target of targets) {
      supabase.from('notifications').insert({
        user_id: target.id,
        title: `${currentUser.display_name ?? 'Someone'} mentioned you in #${ticketNumber}`,
        body: ticketTitle,
        ticket_id: ticketId,
      }).then()

      if (target.email) {
        const plainText = commentContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'comment_mention',
            to: target.email,
            recipientName: target.display_name ?? '',
            senderName: currentUser.display_name ?? 'Someone',
            ticketNumber,
            ticketId,
            ticketTitle,
            ticketType,
            priority: 'medium',
            status: 'todo',
            commentPreview: plainText.slice(0, 120),
          }),
        }).catch(() => {})
      }
    }

    // Mirror to Discord
    if (discordThreadId) {
      const plainText = commentContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      fetch('/api/notify-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          ticketType,
          threadId: discordThreadId,
          content: plainText,
          authorName: currentUser.display_name ?? 'Someone',
        }),
      }).catch(() => {})
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('ticket_comments').delete().eq('id', id)
    if (error) { toast.error('Failed to delete comment'); return }
    setComments((prev) => prev.filter((c) => c.id !== id))
    toast.success('Comment deleted')
  }

  async function handleEdit(id: string, content: string) {
    const { error } = await supabase.from('ticket_comments').update({ content }).eq('id', id)
    if (error) { toast.error('Failed to update comment'); return }
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, content, updated_at: new Date().toISOString() } : c)),
    )
    toast.success('Comment updated')
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex border-b">
        {(['comments', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'comments' ? `Comments (${comments.length})` : `Activity (${activityLogs.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'comments' && (
        <>
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
                  profiles={profiles}
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
            <div className="flex-1 space-y-2">
              <CommentEditor
                key={editorKey}
                value={commentContent}
                onChange={setCommentContent}
                onMentionIds={setMentionedIds}
                profiles={profiles}
                disabled={submitting}
              />
              <CommentImageUploader
                images={commentImages}
                onChange={setCommentImages}
                disabled={submitting}
              />
              <Button size="sm" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Posting...' : 'Post comment'}
              </Button>
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
