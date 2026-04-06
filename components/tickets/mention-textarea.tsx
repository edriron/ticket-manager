'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/layout/user-avatar'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  profiles: Profile[]
  disabled?: boolean
  className?: string
  onPasteImage?: (file: File) => void
  autoFocus?: boolean
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  profiles,
  disabled,
  className,
  onPasteImage,
  autoFocus,
}: MentionTextareaProps) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Filter suggestions based on current query
  const suggestions = mentionQuery !== null
    ? profiles
        .filter((p) => p.display_name != null &&
          (mentionQuery === '' || p.display_name.toLowerCase().includes(mentionQuery.toLowerCase())))
        .slice(0, 6)
    : []

  // Reset selection when suggestions list changes
  useEffect(() => { setSelectedIdx(0) }, [mentionQuery])

  function detectMention(text: string, cursorPos: number) {
    // Match an @ followed by non-whitespace chars up to the cursor
    const before = text.slice(0, cursorPos)
    const match = before.match(/@(\S*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionStart(cursorPos - match[0].length)
    } else {
      setMentionQuery(null)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newVal = e.target.value
    const cursor = e.target.selectionStart ?? newVal.length
    onChange(newVal)
    detectMention(newVal, cursor)
  }

  function selectMention(profile: Profile) {
    if (!profile.display_name) return
    const inserted = `@[${profile.display_name}] `
    const cursorNow = textareaRef.current?.selectionStart ?? (mentionStart + (mentionQuery?.length ?? 0) + 1)
    const newVal = value.slice(0, mentionStart) + inserted + value.slice(cursorNow)
    onChange(newVal)
    setMentionQuery(null)
    const newCursor = mentionStart + inserted.length
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newCursor, newCursor)
    })
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!onPasteImage) return
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    e.preventDefault()
    onPasteImage(file)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[selectedIdx]) selectMention(suggestions[selectedIdx])
    } else if (e.key === 'Escape') {
      setMentionQuery(null)
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
        autoFocus={autoFocus}
      />

      {/* Mention dropdown — appears above the textarea */}
      {mentionQuery !== null && suggestions.length > 0 && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-60 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          {suggestions.map((profile, i) => (
            <button
              key={profile.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left',
                i === selectedIdx && 'bg-muted',
              )}
              onMouseDown={(e) => { e.preventDefault(); selectMention(profile) }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <UserAvatar displayName={profile.display_name} avatarUrl={profile.avatar_url} size="sm" />
              <span className="font-medium truncate">{profile.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Render comment text, highlighting @[name] mentions in blue */
export function renderCommentContent(text: string): React.ReactNode {
  const parts = text.split(/(@\[[^\]]+\])/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^@\[([^\]]+)\]$/)
        return m
          ? <span key={i} className="text-blue-500 font-medium">@{m[1]}</span>
          : <span key={i}>{part}</span>
      })}
    </>
  )
}
