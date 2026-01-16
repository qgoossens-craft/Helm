import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, FileText, Image, File, ChevronDown, ChevronRight, Loader2, AlertCircle, CheckCircle2, Pencil, BookOpen, Calendar, Link, ExternalLink, Video, FileIcon, Globe, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuickTodosStore, useUIStore, useSettingsStore, useCalendarStore } from '../store'
import { MarkdownEditor } from './MarkdownEditor'
import type { QuickTodo, Document, Source } from '../types/global'

interface PreviewState {
  isOpen: boolean
  dataUrl: string | null
  fileName: string
  fileType: string
}

interface RenameState {
  documentId: string | null
  name: string
}

interface SourcePreviewState {
  isOpen: boolean
  source: Source | null
}

interface QuickTodoDetailPanelProps {
  todo: QuickTodo
  onClose: () => void
}

export function QuickTodoDetailPanel({ todo, onClose }: QuickTodoDetailPanelProps) {
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description || '')
  const [documents, setDocuments] = useState<Document[]>([])
  const [showDocuments, setShowDocuments] = useState(true)
  const [, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    dataUrl: null,
    fileName: '',
    fileType: ''
  })
  const [renaming, setRenaming] = useState<RenameState>({
    documentId: null,
    name: ''
  })
  const [dueDate, setDueDate] = useState<string | null>(todo.due_date)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [showSources, setShowSources] = useState(true)
  const [isAddingSource, setIsAddingSource] = useState(false)
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)
  const [sourcePreview, setSourcePreview] = useState<SourcePreviewState>({
    isOpen: false,
    source: null
  })

  const { updateTodo } = useQuickTodosStore()
  const { openObsidianBrowser, isObsidianBrowserOpen, openCopilot } = useUIStore()
  const { settings } = useSettingsStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const wasObsidianBrowserOpen = useRef(false)

  useEffect(() => {
    setTitle(todo.title)
    setDescription(todo.description || '')
    setDueDate(todo.due_date)
    // Auto-resize title textarea after todo changes
    if (titleRef.current) {
      titleRef.current.style.height = 'auto'
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px'
    }
  }, [todo])

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const docs = await window.api.documents.getByQuickTodo(todo.id)
        setDocuments(docs)
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      }
    }
    fetchDocuments()
  }, [todo.id])

  useEffect(() => {
    async function fetchSources() {
      try {
        const srcs = await window.api.sources.getByQuickTodo(todo.id)
        setSources(srcs)
      } catch (err) {
        console.error('Failed to fetch sources:', err)
      }
    }
    fetchSources()
  }, [todo.id])

  // Refetch documents when Obsidian browser closes (after import)
  useEffect(() => {
    if (wasObsidianBrowserOpen.current && !isObsidianBrowserOpen) {
      // Modal just closed, refetch documents
      window.api.documents.getByQuickTodo(todo.id).then(setDocuments).catch(console.error)
    }
    wasObsidianBrowserOpen.current = isObsidianBrowserOpen
  }, [isObsidianBrowserOpen, todo.id])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      // Don't close if clicking on a modal backdrop or inside a modal
      if (target.closest('.modal-backdrop') || target.closest('.modal-content')) {
        return
      }
      if (panelRef.current && !panelRef.current.contains(target)) {
        handleSave()
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // If source preview is open, close it first
        if (sourcePreview.isOpen) {
          setSourcePreview({ isOpen: false, source: null })
          return
        }
        // If document preview is open, close it instead of the panel
        if (preview.isOpen) {
          closePreview()
          return
        }
        handleSave()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, onClose, preview.isOpen, sourcePreview.isOpen])

  const handleSave = async () => {
    if (title === todo.title && description === (todo.description || '')) {
      return
    }
    setIsSaving(true)
    try {
      await updateTodo(todo.id, {
        title: title.trim() || todo.title,
        description: description.trim() || null
      })
    } catch (err) {
      console.error('Failed to save todo:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDueDateChange = async (date: string | null) => {
    setDueDate(date)
    setShowDatePicker(false)
    try {
      await updateTodo(todo.id, { due_date: date })
      // Refresh calendar to show/hide the dot for this date
      useCalendarStore.getState().fetchItems()
    } catch (err) {
      console.error('Failed to update due date:', err)
      setDueDate(todo.due_date)
    }
  }

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    }
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const isOverdue = dueDate && !todo.completed && new Date(dueDate) < new Date(new Date().toDateString())

  const handleDeleteDocument = async (docId: string) => {
    try {
      await window.api.documents.delete(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  const handleUploadDocument = async () => {
    setIsUploading(true)
    try {
      const result = await window.api.documents.upload(null, null, todo.id)
      if (result === null) {
        // User cancelled the dialog
        return
      }
      if (result.success) {
        // Fetch updated document list
        const docs = await window.api.documents.getByQuickTodo(todo.id)
        setDocuments(docs)
        // Poll for processing completion
        pollDocumentStatus(result.documentId)
      } else {
        console.error('Failed to upload document:', result.error)
      }
    } catch (err) {
      console.error('Failed to upload document:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const pollDocumentStatus = async (documentId: string) => {
    const checkStatus = async () => {
      try {
        const doc = await window.api.documents.getById(documentId)
        if (!doc) return

        // Update the document in state
        setDocuments((prev) => prev.map((d) => (d.id === documentId ? doc : d)))

        if (doc.processing_status === 'processing' || doc.processing_status === 'pending') {
          // Continue polling
          setTimeout(checkStatus, 1000)
        } else if (doc.processing_status === 'failed') {
          console.error(`Failed to process "${doc.name}"`)
        }
      } catch (err) {
        console.error('Failed to check document status:', err)
      }
    }

    // Start polling after a short delay
    setTimeout(checkStatus, 500)
  }

  const canPreview = (fileType: string) => {
    return fileType.startsWith('image/') ||
           fileType === 'application/pdf' ||
           fileType.startsWith('text/') ||
           fileType === 'application/json'
  }

  const handlePreviewDocument = async (doc: Document) => {
    if (!canPreview(doc.file_type)) {
      // Open with system default app
      handleOpenExternal(doc)
      return
    }

    try {
      const dataUrl = await window.api.documents.getDataUrl(doc.id)
      if (dataUrl) {
        setPreview({
          isOpen: true,
          dataUrl,
          fileName: doc.name,
          fileType: doc.file_type
        })
      } else {
        console.error('File not found')
      }
    } catch (err) {
      console.error('Failed to load preview:', err)
    }
  }

  const handleOpenExternal = async (doc: Document) => {
    try {
      const result = await window.api.documents.openExternal(doc.id)
      if (result && result !== '') {
        console.error(`Failed to open: ${result}`)
      }
    } catch (err) {
      console.error('Failed to open document:', err)
    }
  }

  const closePreview = () => {
    setPreview({ isOpen: false, dataUrl: null, fileName: '', fileType: '' })
  }

  const handleStartRename = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenaming({ documentId: doc.id, name: doc.name })
  }

  const handleRename = async () => {
    if (!renaming.documentId || !renaming.name.trim()) {
      setRenaming({ documentId: null, name: '' })
      return
    }

    try {
      await window.api.documents.rename(renaming.documentId, renaming.name.trim())
      setDocuments(prev =>
        prev.map(d => d.id === renaming.documentId ? { ...d, name: renaming.name.trim() } : d)
      )
    } catch (err) {
      console.error('Failed to rename document:', err)
    }
    setRenaming({ documentId: null, name: '' })
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setRenaming({ documentId: null, name: '' })
    }
  }

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSourceUrl.trim()) return

    setIsFetchingMetadata(true)
    try {
      // Fetch metadata for the URL
      const metadata = await window.api.sources.fetchMetadata(newSourceUrl.trim())

      // Create the source
      const source = await window.api.sources.create({
        project_id: null,
        task_id: null,
        quick_todo_id: todo.id,
        url: newSourceUrl.trim().startsWith('http') ? newSourceUrl.trim() : 'https://' + newSourceUrl.trim(),
        title: metadata.title,
        description: metadata.description,
        favicon_url: metadata.favicon_url,
        source_type: metadata.source_type
      })

      setSources((prev) => [source, ...prev])
      setNewSourceUrl('')
      setIsAddingSource(false)
    } catch (err) {
      console.error('Failed to add source:', err)
    } finally {
      setIsFetchingMetadata(false)
    }
  }

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await window.api.sources.delete(sourceId)
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
    } catch (err) {
      console.error('Failed to delete source:', err)
    }
  }

  const handleOpenSourceExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const getSourceIcon = (sourceType: Source['source_type']) => {
    switch (sourceType) {
      case 'video':
        return <Video size={16} />
      case 'article':
        return <FileText size={16} />
      case 'document':
        return <FileIcon size={16} />
      default:
        return <Globe size={16} />
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image size={16} />
    if (fileType.includes('pdf') || fileType.includes('document')) return <FileText size={16} />
    return <File size={16} />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getListLabel = (list: QuickTodo['list']) => {
    switch (list) {
      case 'personal':
        return 'Personal'
      case 'work':
        return 'Work'
      case 'tweaks':
        return 'Tweaks'
    }
  }

  return (
    <div
      ref={panelRef}
      className="w-80 h-full bg-helm-surface rounded-2xl flex flex-col animate-slide-in-right"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-helm-border">
        <span className="text-xs text-helm-text-muted">Todo Details</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openCopilot({ quickTodoId: todo.id })}
            className="p-1.5 text-helm-text-muted hover:text-helm-primary hover:bg-helm-surface-elevated rounded transition-colors"
            title="Ask Jeeves"
          >
            <Sparkles size={18} />
          </button>
          <button
            onClick={() => {
              handleSave()
              onClose()
            }}
            className="p-1.5 text-helm-text-muted hover:text-helm-text hover:bg-helm-surface-elevated rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              // Auto-resize
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={handleSave}
            rows={1}
            className="w-full text-lg font-medium text-helm-text bg-transparent border-none outline-none focus:ring-0 placeholder:text-helm-text-muted resize-none overflow-hidden"
            placeholder="Todo title..."
          />
        </div>

        {/* List */}
        <div>
          <label className="text-xs font-medium text-helm-text-muted uppercase tracking-wider block mb-2">
            List
          </label>
          <span className="px-3 py-1.5 rounded text-xs font-medium bg-helm-surface-elevated text-helm-text border border-helm-border">
            {getListLabel(todo.list)}
          </span>
        </div>

        {/* Due Date */}
        <div>
          <label className="text-xs font-medium text-helm-text-muted uppercase tracking-wider block mb-2">
            Due Date
          </label>
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                dueDate
                  ? isOverdue
                    ? 'text-helm-error bg-helm-error/10 border border-helm-error/30'
                    : 'text-helm-text bg-helm-surface-elevated border border-helm-border'
                  : 'text-helm-text-muted bg-helm-surface-elevated border border-helm-border hover:text-helm-text hover:border-helm-text-muted'
              }`}
            >
              <Calendar size={14} />
              {dueDate ? formatDueDate(dueDate) : 'Set due date'}
            </button>

            {showDatePicker && (
              <div className="absolute left-0 top-full mt-1 bg-helm-surface border border-helm-border rounded-lg shadow-lg p-2 z-10">
                <input
                  type="date"
                  value={dueDate || ''}
                  onChange={(e) => handleDueDateChange(e.target.value || null)}
                  className="bg-helm-bg border border-helm-border rounded px-2 py-1 text-sm text-helm-text"
                  autoFocus
                />
                {dueDate && (
                  <button
                    onClick={() => handleDueDateChange(null)}
                    className="w-full mt-2 px-2 py-1 text-xs text-helm-text-muted hover:text-helm-error transition-colors"
                  >
                    Clear date
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-helm-text-muted uppercase tracking-wider block mb-2">
            Description
          </label>
          <MarkdownEditor
            content={description}
            onChange={setDescription}
            onBlur={handleSave}
            placeholder="Add a description... (use **bold**, *italic*, # headings)"
            className="w-full px-3 py-2 bg-helm-bg border border-helm-border rounded-lg text-sm text-helm-text focus-within:border-helm-primary transition-colors"
            autoFocus
          />
        </div>

        {/* Documents */}
        <div>
          <button
            onClick={() => setShowDocuments(!showDocuments)}
            className="flex items-center gap-2 text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2 hover:text-helm-text transition-colors"
          >
            {showDocuments ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Documents
            {documents.length > 0 && (
              <span className="text-helm-text-muted">({documents.length})</span>
            )}
          </button>

          {showDocuments && (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 p-2 bg-helm-bg border rounded-lg group ${
                    doc.processing_status === 'failed'
                      ? 'border-helm-error/50'
                      : doc.processing_status === 'processing' || doc.processing_status === 'pending'
                      ? 'border-helm-primary/50'
                      : 'border-helm-border'
                  }`}
                >
                  <span className="text-helm-text-muted">{getFileIcon(doc.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    {renaming.documentId === doc.id ? (
                      <input
                        type="text"
                        value={renaming.name}
                        onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                        onBlur={handleRename}
                        onKeyDown={handleRenameKeyDown}
                        autoFocus
                        className="w-full text-sm text-helm-text bg-helm-surface border border-helm-primary rounded px-1 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p
                        className={`text-sm text-helm-text truncate ${
                          doc.processing_status === 'completed'
                            ? 'cursor-pointer hover:text-helm-primary'
                            : ''
                        }`}
                        onClick={() => {
                          if (doc.processing_status === 'completed') {
                            handlePreviewDocument(doc)
                          }
                        }}
                        title={doc.processing_status === 'completed' ? 'Click to open' : doc.name}
                      >
                        {doc.name}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-helm-text-muted">{formatFileSize(doc.file_size)}</p>
                      {doc.processing_status === 'pending' && (
                        <span className="flex items-center gap-1 text-xs text-helm-text-muted">
                          <Loader2 size={10} className="animate-spin" />
                          Queued
                        </span>
                      )}
                      {doc.processing_status === 'processing' && (
                        <span className="flex items-center gap-1 text-xs text-helm-primary">
                          <Loader2 size={10} className="animate-spin" />
                          Processing
                        </span>
                      )}
                      {doc.processing_status === 'completed' && (
                        <span className="flex items-center gap-1 text-xs text-helm-success">
                          <CheckCircle2 size={10} />
                          Ready
                        </span>
                      )}
                      {doc.processing_status === 'failed' && (
                        <span className="flex items-center gap-1 text-xs text-helm-error" title={doc.processing_error || undefined}>
                          <AlertCircle size={10} />
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleStartRename(doc, e)}
                    className="p-1 text-helm-text-muted hover:text-helm-primary opacity-0 group-hover:opacity-100 transition-all"
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteDocument(doc.id)
                    }}
                    className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {documents.length === 0 && (
                <p className="text-sm text-helm-text-muted py-2">
                  No documents attached
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleUploadDocument}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-helm-text-muted hover:text-helm-text hover:bg-helm-bg rounded-lg transition-colors flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Add document
                    </>
                  )}
                </button>
                {settings.obsidian_vault_path && (
                  <button
                    onClick={() => openObsidianBrowser({ projectId: null, taskId: null, quickTodoId: todo.id })}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-helm-text-muted hover:text-helm-text hover:bg-helm-bg rounded-lg transition-colors"
                    title="Import from Obsidian"
                  >
                    <BookOpen size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sources (URL links) */}
        <div>
          <button
            onClick={() => setShowSources(!showSources)}
            className="flex items-center gap-2 text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2 hover:text-helm-text transition-colors"
          >
            {showSources ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Sources
            {sources.length > 0 && (
              <span className="text-helm-text-muted">({sources.length})</span>
            )}
          </button>

          {showSources && (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-3 p-2 bg-helm-bg border border-helm-border rounded-lg group cursor-pointer hover:border-helm-primary/50 transition-colors"
                  onClick={() => setSourcePreview({ isOpen: true, source })}
                >
                  {source.favicon_url ? (
                    <img
                      src={source.favicon_url}
                      alt=""
                      className="w-4 h-4 rounded flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <span className={`text-helm-text-muted flex-shrink-0 ${source.favicon_url ? 'hidden' : ''}`}>
                    {getSourceIcon(source.source_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-helm-text truncate">{source.title}</p>
                    <p className="text-xs text-helm-text-muted truncate">
                      {new URL(source.url).hostname}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenSourceExternal(source.url)
                    }}
                    className="p-1 text-helm-text-muted hover:text-helm-primary opacity-0 group-hover:opacity-100 transition-all"
                    title="Open in browser"
                  >
                    <ExternalLink size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSource(source.id)
                    }}
                    className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {sources.length === 0 && !isAddingSource && (
                <p className="text-sm text-helm-text-muted py-2">
                  No sources linked
                </p>
              )}

              {isAddingSource ? (
                <form onSubmit={handleAddSource} className="space-y-2">
                  <div className="relative">
                    <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-helm-text-muted" />
                    <input
                      type="text"
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      placeholder="Paste URL..."
                      autoFocus
                      disabled={isFetchingMetadata}
                      className="w-full pl-9 pr-4 py-2 bg-helm-bg border border-helm-border rounded-lg text-sm text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isFetchingMetadata || !newSourceUrl.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-helm-primary hover:bg-helm-primary-hover text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingMetadata ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        'Add'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingSource(false)
                        setNewSourceUrl('')
                      }}
                      disabled={isFetchingMetadata}
                      className="px-3 py-1.5 text-sm text-helm-text-muted hover:text-helm-text rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingSource(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-helm-text-muted hover:text-helm-text hover:bg-helm-bg rounded-lg transition-colors w-full"
                >
                  <Plus size={14} />
                  Add source
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-helm-border">
        <p className="text-xs text-helm-text-muted">
          Created {new Date(todo.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          {todo.completed_at && ` · Completed ${new Date(todo.completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}`}
        </p>
      </div>

      {/* Document Preview Modal */}
      {preview.isOpen && preview.dataUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-8"
          onClick={closePreview}
        >
          {/* X button positioned at top-right of viewport */}
          <button
            onClick={closePreview}
            className="fixed top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-[101]"
          >
            <X size={24} />
          </button>

          <div className="max-w-full max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Image preview */}
            {preview.fileType.startsWith('image/') && (
              <img
                src={preview.dataUrl}
                alt={preview.fileName}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            )}

            {/* PDF preview */}
            {preview.fileType === 'application/pdf' && (
              <iframe
                src={preview.dataUrl}
                title={preview.fileName}
                className="w-[90vw] max-w-4xl h-[80vh] rounded-lg shadow-2xl bg-white"
              />
            )}

            {/* Markdown preview */}
            {preview.fileType === 'text/markdown' && (
              <div className="w-[90vw] max-w-4xl h-[80vh] overflow-auto bg-helm-surface text-helm-text p-6 rounded-lg shadow-2xl">
                <div className="prose prose-helm prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {new TextDecoder().decode(Uint8Array.from(atob(preview.dataUrl.split(',')[1]), c => c.charCodeAt(0)))}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Text/JSON preview (non-markdown) */}
            {(preview.fileType.startsWith('text/') && preview.fileType !== 'text/markdown') || preview.fileType === 'application/json' ? (
              <pre className="w-[90vw] max-w-4xl h-[80vh] overflow-auto bg-helm-surface text-helm-text p-6 rounded-lg shadow-2xl text-sm font-mono whitespace-pre-wrap">
                {new TextDecoder().decode(Uint8Array.from(atob(preview.dataUrl.split(',')[1]), c => c.charCodeAt(0)))}
              </pre>
            ) : null}

            <p className="text-center text-helm-text-muted text-sm mt-4 bg-helm-surface/80 px-3 py-1 rounded">{preview.fileName}</p>
          </div>
        </div>
      )}

      {/* Source Preview Modal */}
      {sourcePreview.isOpen && sourcePreview.source && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-8"
          onClick={() => setSourcePreview({ isOpen: false, source: null })}
        >
          <div
            className="bg-helm-surface rounded-xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-helm-border">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {sourcePreview.source.favicon_url ? (
                  <img
                    src={sourcePreview.source.favicon_url}
                    alt=""
                    className="w-6 h-6 rounded flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="text-helm-text-muted">{getSourceIcon(sourcePreview.source.source_type)}</span>
                )}
                <span className="text-sm font-medium text-helm-text truncate">
                  {new URL(sourcePreview.source.url).hostname}
                </span>
              </div>
              <button
                onClick={() => setSourcePreview({ isOpen: false, source: null })}
                className="p-1.5 text-helm-text-muted hover:text-helm-text hover:bg-helm-bg rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <h3 className="text-lg font-semibold text-helm-text leading-tight">
                {sourcePreview.source.title}
              </h3>
              {sourcePreview.source.description && (
                <p className="text-sm text-helm-text-muted line-clamp-3">
                  {sourcePreview.source.description}
                </p>
              )}
              <p className="text-xs text-helm-text-muted truncate">
                {sourcePreview.source.url}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 pt-2">
              <button
                onClick={() => {
                  handleOpenSourceExternal(sourcePreview.source!.url)
                  setSourcePreview({ isOpen: false, source: null })
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-helm-primary hover:bg-helm-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink size={16} />
                Open in Browser
              </button>
              <button
                onClick={() => setSourcePreview({ isOpen: false, source: null })}
                className="px-4 py-2.5 text-sm text-helm-text-muted hover:text-helm-text hover:bg-helm-bg rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
