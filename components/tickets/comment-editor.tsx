'use client'

import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect, useReducer } from 'react'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Highlighter, Palette,
} from 'lucide-react'
import type { Profile } from '@/types'

// ─── Mention suggestion dropdown ──────────────────────────────────────────────

interface MentionDropdownProps {
  items: Profile[]
  command: (item: { id: string; label: string }) => void
}

const MentionDropdown = forwardRef<{ onKeyDown: (p: SuggestionKeyDownProps) => boolean }, MentionDropdownProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          const item = items[selectedIndex]
          if (item) command({ id: item.id, label: item.display_name ?? '' })
          return true
        }
        return false
      },
    }))

    if (!items.length) return null
    return (
      <div className="border rounded-md shadow-md bg-popover text-popover-foreground w-48 py-1 z-50">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'w-full text-left px-3 py-1.5 text-sm transition-colors',
              i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )}
            onMouseDown={(e) => { e.preventDefault(); command({ id: item.id, label: item.display_name ?? '' }) }}
          >
            {item.display_name}
          </button>
        ))}
      </div>
    )
  },
)
MentionDropdown.displayName = 'MentionDropdown'

// ─── Force re-render on editor transaction (selection changes, marks, etc.) ──

function useEditorUpdate(editor: ReturnType<typeof useEditor> | null) {
  const [, dispatch] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', dispatch)
    return () => { editor.off('transaction', dispatch) }
  }, [editor])
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

function ToolbarBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'flex items-center justify-center h-6 w-6 rounded text-xs transition-colors shrink-0',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

const COLORS = [
  '#000000', '#374151', '#6b7280', '#dc2626',
  '#ea580c', '#16a34a', '#2563eb', '#7c3aed',
]

function ColorPicker({ icon: Icon, title, onSelect, onClear }: {
  icon: React.ElementType; title: string; onSelect: (c: string) => void; onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v) }}
        className="flex items-center justify-center h-6 w-6 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
        <Icon className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute top-7 left-0 z-50 bg-popover border rounded-lg shadow-md p-2 w-28" onMouseDown={(e) => e.preventDefault()}>
          <div className="grid grid-cols-4 gap-1 mb-1">
            {COLORS.map((c) => (
              <button key={c} type="button" className="h-5 w-5 rounded border border-border" style={{ backgroundColor: c }}
                onMouseDown={(e) => { e.preventDefault(); onSelect(c); setOpen(false) }} />
            ))}
          </div>
          <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => { e.preventDefault(); onClear(); setOpen(false) }}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Extract mention ids from TipTap JSON ─────────────────────────────────────

export function extractMentionIds(doc: JSONContent): string[] {
  const ids: string[] = []
  function walk(node: JSONContent) {
    if (node.type === 'mention' && node.attrs?.id) ids.push(node.attrs.id as string)
    node.content?.forEach(walk)
  }
  walk(doc)
  return ids
}

// ─── Main CommentEditor ───────────────────────────────────────────────────────

interface CommentEditorProps {
  value?: string
  onChange: (html: string) => void
  onMentionIds?: (ids: string[]) => void
  profiles: Profile[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CommentEditor({
  value = '',
  onChange,
  onMentionIds,
  profiles,
  placeholder = 'Leave a comment… type @ to mention someone',
  disabled,
  className,
}: CommentEditorProps) {
  const [suggestion, setSuggestion] = useState<SuggestionProps<Profile> | null>(null)
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 })
  const suggestionRef = useRef<{ onKeyDown: (p: SuggestionKeyDownProps) => boolean } | null>(null)

  const setSuggestionState = useCallback((props: SuggestionProps<Profile> | null) => {
    setSuggestion(props)
    if (props?.clientRect) {
      const rect = props.clientRect()
      if (rect) setSuggestionPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
    }
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderHTML({ options, node }) {
          return ['span', { ...options.HTMLAttributes }, `@${node.attrs.label}`]
        },
        suggestion: {
          items: ({ query }) =>
            profiles
              .filter((p) => p.display_name?.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 6),
          render: () => {
            return {
              onStart: (props) => setSuggestionState(props as SuggestionProps<Profile>),
              onUpdate: (props) => setSuggestionState(props as SuggestionProps<Profile>),
              onExit: () => setSuggestionState(null),
              onKeyDown: (props) => suggestionRef.current?.onKeyDown(props) ?? false,
            }
          },
        },
      }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
      if (onMentionIds) onMentionIds(extractMentionIds(editor.getJSON()))
    },
  })

  useEditorUpdate(editor)

  if (!editor) return null

  return (
    <div className={cn('relative', className)}>
      <div className="border rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
        {/* Compact toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b bg-muted/30">
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
            <Bold className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
            <Italic className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
            <UnderlineIcon className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
            <Strikethrough className="h-3 w-3" />
          </ToolbarBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
            <List className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
            <ListOrdered className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
            <Quote className="h-3 w-3" />
          </ToolbarBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ColorPicker icon={Palette} title="Font color"
            onSelect={(c) => editor.chain().focus().setColor(c).run()}
            onClear={() => editor.chain().focus().unsetColor().run()} />
          <ColorPicker icon={Highlighter} title="Background color"
            onSelect={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
            onClear={() => editor.chain().focus().unsetHighlight().run()} />
        </div>
        <EditorContent
          editor={editor}
          className="rich-content px-3 py-2 text-sm min-h-20"
        />
      </div>

      {/* Mention dropdown */}
      {suggestion && (
        <div style={{ position: 'fixed', top: suggestionPos.top, left: suggestionPos.left, zIndex: 9999 }}>
          <MentionDropdown
            ref={suggestionRef}
            items={suggestion.items as Profile[]}
            command={(item) => suggestion.command(item)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Rich text renderer for comments ─────────────────────────────────────────

export function CommentContent({ content, className }: { content: string | null | undefined; className?: string }) {
  if (!content) return null
  const isHtml = content.trimStart().startsWith('<')
  if (!isHtml) {
    // Legacy plain text with @[Name] mention format
    const parts: React.ReactNode[] = []
    const mentionPattern = /@\[([^\]]+)\]/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = mentionPattern.exec(content)) !== null) {
      if (m.index > last) parts.push(content.slice(last, m.index))
      parts.push(<span key={m.index} className="text-primary font-medium">@{m[1]}</span>)
      last = m.index + m[0].length
    }
    if (last < content.length) parts.push(content.slice(last))
    return <p className={cn('text-sm whitespace-pre-wrap', className)}>{parts}</p>
  }
  return (
    <div
      className={cn('rich-content text-sm', className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
