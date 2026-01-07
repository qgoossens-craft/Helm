import { useState, useEffect, useRef } from 'react'
import { X, Check, Plus, Trash2, FileText, Image, File, ChevronDown, ChevronRight, Loader2, AlertCircle, CheckCircle2, Pencil, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTasksStore, useUIStore, useSettingsStore } from '../store'
import { MarkdownEditor } from './MarkdownEditor'
import type { Task, Document } from '../types/global'

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

interface TaskDetailPanelProps {
  task: Task
  onClose: () => void
  projectId: string
}

export function TaskDetailPanel({ task, onClose, projectId }: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [status, setStatus] = useState(task.status)
  const [documents, setDocuments] = useState<Document[]>([])
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [showSubtasks, setShowSubtasks] = useState(true)
  const [showDocuments, setShowDocuments] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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

  const { tasks, updateTask, createTask, deleteTask, fetchTasksByProject } = useTasksStore()
  const { openObsidianBrowser, isObsidianBrowserOpen } = useUIStore()
  const { settings } = useSettingsStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const wasObsidianBrowserOpen = useRef(false)

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description || '')
    setStatus(task.status)
    // Auto-resize title textarea after task changes
    if (titleRef.current) {
      titleRef.current.style.height = 'auto'
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px'
    }
  }, [task])


  useEffect(() => {
    const filtered = tasks.filter((t) => t.parent_task_id === task.id)
    setSubtasks(filtered)
  }, [tasks, task.id])

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const docs = await window.api.documents.getByTask(task.id)
        setDocuments(docs)
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      }
    }
    fetchDocuments()
  }, [task.id])

  // Refetch documents when Obsidian browser closes (after import)
  useEffect(() => {
    if (wasObsidianBrowserOpen.current && !isObsidianBrowserOpen) {
      // Modal just closed, refetch documents
      window.api.documents.getByTask(task.id).then(setDocuments).catch(console.error)
    }
    wasObsidianBrowserOpen.current = isObsidianBrowserOpen
  }, [isObsidianBrowserOpen, task.id])

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
  }, [title, description, status])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // If preview is open, close it instead of the panel
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
  }, [title, description, status, onClose, preview.isOpen])

  const handleSave = async () => {
    if (title === task.title && description === (task.description || '') && status === task.status) {
      return
    }
    setIsSaving(true)
    try {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description: description.trim() || null,
        status
      })
    } catch (err) {
      console.error('Failed to save task:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: Task['status']) => {
    setStatus(newStatus)
    try {
      await updateTask(task.id, { status: newStatus })
    } catch (err) {
      console.error('Failed to update status:', err)
      setStatus(task.status)
    }
  }

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtask.trim()) return

    try {
      await createTask({
        project_id: projectId,
        parent_task_id: task.id,
        title: newSubtask.trim(),
        description: null,
        status: 'todo',
        order: subtasks.length
      })
      setNewSubtask('')
      setIsAddingSubtask(false)
    } catch (err) {
      console.error('Failed to add subtask:', err)
    }
  }

  const handleToggleSubtask = async (subtask: Task) => {
    try {
      const newStatus = subtask.status === 'done' ? 'todo' : 'done'
      await updateTask(subtask.id, { status: newStatus })
    } catch (err) {
      console.error('Failed to update subtask:', err)
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await deleteTask(subtaskId)
    } catch (err) {
      console.error('Failed to delete subtask:', err)
    }
  }

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
      const result = await window.api.documents.upload(task.id, projectId)
      if (result === null) {
        // User cancelled the dialog
        return
      }
      if (result.success) {
        // Fetch updated document list
        const docs = await window.api.documents.getByTask(task.id)
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

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        setIsUploading(true)
        try {
          // Convert file to base64
          const buffer = await file.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          )

          const result = await window.api.documents.uploadFromClipboard(
            base64,
            file.type,
            task.id,
            projectId
          )

          if (result.success) {
            const docs = await window.api.documents.getByTask(task.id)
            setDocuments(docs)
            pollDocumentStatus(result.documentId)
          } else {
            console.error('Failed to upload screenshot:', result.error)
          }
        } catch (err) {
          console.error('Failed to upload screenshot:', err)
        } finally {
          setIsUploading(false)
        }
        break
      }
    }
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

  const statusOptions: { value: Task['status']; label: string; color: string }[] = [
    { value: 'todo', label: 'To Do', color: 'bg-helm-surface-elevated text-helm-text-muted' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-helm-primary/20 text-helm-primary' },
    { value: 'done', label: 'Done', color: 'bg-helm-success/20 text-helm-success' }
  ]

  const completedSubtasks = subtasks.filter((s) => s.status === 'done').length

  return (
    <div
      ref={panelRef}
      className="w-80 h-full bg-helm-surface rounded-2xl flex flex-col animate-slide-in-right"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-helm-border">
        <span className="text-xs text-helm-text-muted">Task Details</span>
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
            placeholder="Task title..."
          />
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-medium text-helm-text-muted uppercase tracking-wider block mb-2">
            Status
          </label>
          <div className="flex gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  status === opt.value
                    ? opt.color
                    : 'bg-helm-surface-elevated text-helm-text-muted hover:text-helm-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
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

        {/* Subtasks */}
        <div>
          <button
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="flex items-center gap-2 text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2 hover:text-helm-text transition-colors"
          >
            {showSubtasks ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Subtasks
            {subtasks.length > 0 && (
              <span className="text-helm-text-muted">
                ({completedSubtasks}/{subtasks.length})
              </span>
            )}
          </button>

          {showSubtasks && (
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 p-2 bg-helm-bg border border-helm-border rounded-lg group"
                >
                  <button
                    onClick={() => handleToggleSubtask(subtask)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      subtask.status === 'done'
                        ? 'bg-helm-primary border-helm-primary text-white'
                        : 'border-helm-border hover:border-helm-primary'
                    }`}
                  >
                    {subtask.status === 'done' && <Check size={10} />}
                  </button>
                  <span
                    className={`flex-1 text-sm truncate ${
                      subtask.status === 'done' ? 'text-helm-text-muted line-through' : 'text-helm-text'
                    }`}
                  >
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {isAddingSubtask ? (
                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Subtask title..."
                    autoFocus
                    className="flex-1 px-3 py-1.5 bg-helm-bg border border-helm-border rounded-lg text-sm text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-helm-primary hover:bg-helm-primary-hover text-white text-sm rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingSubtask(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-helm-text-muted hover:text-helm-text hover:bg-helm-bg rounded-lg transition-colors w-full"
                >
                  <Plus size={14} />
                  Add subtask
                </button>
              )}
            </div>
          )}
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
                    onClick={() => openObsidianBrowser({ projectId, taskId: task.id })}
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
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-helm-border">
        <p className="text-xs text-helm-text-muted">
          Created {new Date(task.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          {task.completed_at && ` · Completed ${new Date(task.completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}`}
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
    </div>
  )
}
