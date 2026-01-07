import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import { useEffect } from 'react'
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Code } from 'lucide-react'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function MarkdownEditor({ content, onChange, onBlur, placeholder, className, autoFocus }: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing...'
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-helm-primary underline'
        }
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true
      })
    ],
    content: content || '',
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      // Get markdown content for storage
      const markdown = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
      onChange(markdown)
    },
    onBlur: () => {
      onBlur?.()
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[150px]'
      }
    }
  })

  // Sync content when it changes externally (e.g., switching tasks)
  useEffect(() => {
    if (editor && (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown() !== content) {
      editor.commands.setContent(content || '')
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={className}>
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 pb-2 mb-2 border-b border-helm-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isFocused && editor.isActive('bold')}
          title="Bold (Cmd+B)"
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isFocused && editor.isActive('italic')}
          title="Italic (Cmd+I)"
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isFocused && editor.isActive('code')}
          title="Inline Code"
        >
          <Code size={14} />
        </ToolbarButton>

        <div className="w-px h-4 bg-helm-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isFocused && editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isFocused && editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </ToolbarButton>

        <div className="w-px h-4 bg-helm-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isFocused && editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isFocused && editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  )
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-helm-primary/20 text-helm-primary'
          : 'text-helm-text-muted hover:text-helm-text hover:bg-helm-surface-elevated'
      }`}
    >
      {children}
    </button>
  )
}
