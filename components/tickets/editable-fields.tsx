'use client'

import { useState, useEffect, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RichTextEditor, RichTextContent } from '@/components/ui/rich-text-editor'

// ─── EditableMultiline ────────────────────────────────────────────────────────
// Click to edit a textarea field. Auto-saves when focus leaves the component.

interface EditableMultilineProps {
  label: string
  value: string | null
  onSave: (val: string | null) => Promise<void>
  placeholder?: string
  rows?: number
  labelClassName?: string
}

export function EditableMultiline({
  label,
  value,
  onSave,
  placeholder = 'Click to add…',
  rows = 3,
  labelClassName,
}: EditableMultilineProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  async function save() {
    setSaving(true)
    await onSave(draft.trim() || null)
    setSaving(false)
    setEditing(false)
  }

  function cancel() { setDraft(value ?? ''); setEditing(false) }

  // Auto-save when focus moves outside this component entirely
  function handleBlur(e: React.FocusEvent) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return
    if (draft !== (value ?? '')) {
      save()
    } else {
      setEditing(false)
    }
  }

  return (
    <div ref={containerRef}>
      <h3 className={cn('text-sm font-semibold mb-1.5', labelClassName)}>{label}</h3>
      {editing ? (
        <div className="space-y-1.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={rows}
            autoFocus
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
            }}
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 px-2 text-xs" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="group relative cursor-text rounded px-2 py-1 -mx-2 hover:bg-muted/50 transition-colors outline-none"
          onClick={() => { setDraft(value ?? ''); setEditing(true) }}
        >
          {value ? (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{value}</p>
          ) : (
            <p className="text-sm text-muted-foreground/40 italic">{placeholder}</p>
          )}
          <Pencil className="absolute top-1 right-1 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
      )}
    </div>
  )
}

// ─── EditableRichText ─────────────────────────────────────────────────────────
// Click to edit a rich-text (TipTap) field. Explicit Save/Cancel buttons.

interface EditableRichTextProps {
  label: string
  value: string | null
  onSave: (val: string | null) => Promise<void>
  placeholder?: string
  labelClassName?: string
}

export function EditableRichText({
  label,
  value,
  onSave,
  placeholder = 'Click to add…',
  labelClassName,
}: EditableRichTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  async function save() {
    setSaving(true)
    await onSave(draft.trim() || null)
    setSaving(false)
    setEditing(false)
  }

  function cancel() { setDraft(value ?? ''); setEditing(false) }

  return (
    <div>
      <h3 className={cn('text-sm font-semibold mb-1.5', labelClassName)}>{label}</h3>
      {editing ? (
        <div className="space-y-1.5">
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            minHeight="100px"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 px-2 text-xs" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="group relative cursor-text rounded px-2 py-1 -mx-2 hover:bg-muted/50 transition-colors outline-none"
          onClick={() => { setDraft(value ?? ''); setEditing(true) }}
        >
          {value ? (
            <RichTextContent content={value} className="text-muted-foreground leading-relaxed" />
          ) : (
            <p className="text-sm text-muted-foreground/40 italic">{placeholder}</p>
          )}
          <Pencil className="absolute top-1 right-1 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
      )}
    </div>
  )
}

// ─── EditableSingleLine ───────────────────────────────────────────────────────
// Click to edit an input field. Saves on Enter or blur.

interface EditableSingleLineProps {
  value: string | null
  onSave: (val: string | null) => Promise<void>
  placeholder?: string
  inputType?: string
  className?: string
}

export function EditableSingleLine({
  value,
  onSave,
  placeholder = 'Click to add…',
  inputType = 'text',
  className,
}: EditableSingleLineProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  async function save() {
    if (draft.trim() === (value ?? '').trim()) { setEditing(false); return }
    setSaving(true)
    await onSave(draft.trim() || null)
    setSaving(false)
    setEditing(false)
  }

  function cancel() { setDraft(value ?? ''); setEditing(false) }

  if (editing) {
    return (
      <Input
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        disabled={saving}
        className={cn('h-8 text-sm', className)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        onBlur={save}
      />
    )
  }

  return (
    <div
      className={cn('group relative cursor-text rounded px-2 py-1 -mx-2 hover:bg-muted/50 transition-colors outline-none', className)}
      onClick={() => { setDraft(value ?? ''); setEditing(true) }}
    >
      {value ? (
        <span className="text-sm text-muted-foreground break-all">{value}</span>
      ) : (
        <span className="text-sm text-muted-foreground/40 italic">{placeholder}</span>
      )}
      <Pencil className="absolute top-1 right-1 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
    </div>
  )
}
