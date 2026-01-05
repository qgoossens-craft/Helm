import { useState, useEffect, useRef } from 'react'
import { X, Check, Plus, Trash2, FileText, Image, File, ChevronDown, ChevronRight } from 'lucide-react'
import { useTasksStore, useUIStore } from '../store'
import type { Task, Document } from '../types/global'

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

  const { tasks, updateTask, createTask, deleteTask, fetchTasksByProject } = useTasksStore()
  const { addToast } = useUIStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description || '')
    setStatus(task.status)
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleSave()
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [title, description, status])

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
      addToast('error', 'Failed to save task')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: Task['status']) => {
    setStatus(newStatus)
    try {
      await updateTask(task.id, { status: newStatus })
      addToast('success', newStatus === 'done' ? 'Task completed!' : `Status updated`)
    } catch (err) {
      addToast('error', 'Failed to update status')
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
      addToast('success', 'Subtask added')
    } catch (err) {
      addToast('error', 'Failed to add subtask')
    }
  }

  const handleToggleSubtask = async (subtask: Task) => {
    try {
      const newStatus = subtask.status === 'done' ? 'todo' : 'done'
      await updateTask(subtask.id, { status: newStatus })
    } catch (err) {
      addToast('error', 'Failed to update subtask')
    }
  }

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await deleteTask(subtaskId)
      addToast('success', 'Subtask deleted')
    } catch (err) {
      addToast('error', 'Failed to delete subtask')
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await window.api.documents.delete(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      addToast('success', 'Document removed')
    } catch (err) {
      addToast('error', 'Failed to delete document')
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
      className="w-96 h-full bg-helm-surface border-l border-helm-border flex flex-col animate-slide-in-right"
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
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full text-lg font-medium text-helm-text bg-transparent border-none outline-none focus:ring-0 placeholder:text-helm-text-muted"
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
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            rows={4}
            className="w-full px-3 py-2 bg-helm-bg border border-helm-border rounded-lg text-sm text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors resize-none"
            placeholder="Add a description..."
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
                  className="flex items-center gap-3 p-2 bg-helm-bg border border-helm-border rounded-lg group"
                >
                  <span className="text-helm-text-muted">{getFileIcon(doc.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-helm-text truncate">{doc.name}</p>
                    <p className="text-xs text-helm-text-muted">{formatFileSize(doc.file_size)}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {documents.length === 0 && (
                <p className="text-sm text-helm-text-muted text-center py-4">
                  No documents attached
                </p>
              )}

              <button
                onClick={() => addToast('info', 'Document upload coming soon!')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-helm-text-muted hover:text-helm-text hover:bg-helm-bg rounded-lg transition-colors w-full"
              >
                <Plus size={14} />
                Add document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-helm-border">
        <p className="text-xs text-helm-text-muted">
          Created {new Date(task.created_at).toLocaleDateString()}
          {task.completed_at && ` · Completed ${new Date(task.completed_at).toLocaleDateString()}`}
        </p>
      </div>
    </div>
  )
}
