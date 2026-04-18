'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  List, ListOrdered, Quote, Minus, Pilcrow,
  Highlighter, Palette,
} from 'lucide-react'
import { useState, useEffect, useReducer } from 'react'

// Forces a re-render whenever the editor fires a transaction (incl. selection changes).
function useEditorUpdate(editor: Editor | null) {
  const [, dispatch] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', dispatch)
    return () => { editor.off('transaction', dispatch) }
  }, [editor])
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, title, disabled, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center h-7 w-7 rounded text-sm transition-colors shrink-0',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
}

// ─── Color picker ─────────────────────────────────────────────────────────────

const COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
]

function ColorPicker({
  icon: Icon,
  title,
  onSelect,
  onClear,
}: {
  icon: React.ElementType
  title: string
  onSelect: (color: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v) }}
        title={title}
        className="flex items-center justify-center h-7 w-7 rounded text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="absolute top-8 left-0 z-50 bg-popover border rounded-lg shadow-md p-2 w-36"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-4 gap-1 mb-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onMouseDown={(e) => { e.preventDefault(); onSelect(c); setOpen(false) }}
              />
            ))}
          </div>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground py-0.5"
            onMouseDown={(e) => { e.preventDefault(); onClear(); setOpen(false) }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  useEditorUpdate(editor)
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
      <ToolbarBtn
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph')}
        title="Paragraph"
      >
        <Pilcrow className="h-3.5 w-3.5" />
      </ToolbarBtn>

      {([1, 2, 3, 4, 5, 6] as const).map((level) => {
        const icons = { 1: Heading1, 2: Heading2, 3: Heading3, 4: Heading4, 5: Heading5, 6: Heading6 }
        const Icon = icons[level]
        return (
          <ToolbarBtn
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            active={editor.isActive('heading', { level })}
            title={`Heading ${level}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </ToolbarBtn>
        )
      })}

      <Divider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
        <Quote className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider">
        <Minus className="h-3.5 w-3.5" />
      </ToolbarBtn>

      <Divider />

      <ColorPicker
        icon={Palette}
        title="Font color"
        onSelect={(c) => editor.chain().focus().setColor(c).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <ColorPicker
        icon={Highlighter}
        title="Background color"
        onSelect={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
      />
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something…',
  className,
  disabled,
  minHeight = '120px',
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChange(html)
    },
  })

  if (!editor) return null

  return (
    <div className={cn('border rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring', className)}>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="rich-content px-3 py-2 text-sm"
      />
    </div>
  )
}

// ─── Safe HTML renderer ───────────────────────────────────────────────────────

export function RichTextContent({ content, className }: { content: string | null | undefined; className?: string }) {
  if (!content) return null
  const isHtml = content.trimStart().startsWith('<')
  if (!isHtml) {
    return <p className={cn('text-sm whitespace-pre-wrap', className)}>{content}</p>
  }
  return (
    <div
      className={cn('rich-content text-sm', className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
