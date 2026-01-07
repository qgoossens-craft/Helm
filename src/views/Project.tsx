import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { List, LayoutGrid, Plus, Check, Trash2, FileText, Image, File, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Filter, X, RotateCcw, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useProjectsStore, useTasksStore, useUIStore } from '../store'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import type { Task, Document } from '../types/global'

type ViewMode = 'list' | 'kanban'
type TaskFilter = 'all' | 'active' | 'todo' | 'in_progress' | 'done' | 'deleted'

export function Project() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('active')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showDocuments, setShowDocuments] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [preview, setPreview] = useState<{
    isOpen: boolean
    dataUrl: string | null
    fileName: string
    fileType: string
  }>({ isOpen: false, dataUrl: null, fileName: '', fileType: '' })

  const { projects, fetchProjects, deleteProject } = useProjectsStore()
  const navigate = useNavigate()
  const { tasks, deletedTasks, fetchTasksByProject, fetchDeletedTasks, createTask, updateTask, deleteTask, restoreTask } = useTasksStore()
  const { openCopilot } = useUIStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (id) {
      fetchTasksByProject(id)
    }
  }, [id, fetchTasksByProject])

  // Fetch deleted tasks when filter is selected
  useEffect(() => {
    if (id && taskFilter === 'deleted') {
      fetchDeletedTasks(id)
    }
  }, [id, taskFilter, fetchDeletedTasks])

  // Auto-select task from URL query param
  useEffect(() => {
    const taskId = searchParams.get('task')
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        setSelectedTask(task)
        // Clear the query param after selecting
        setSearchParams({}, { replace: true })
      }
    }
  }, [searchParams, tasks, setSearchParams])

  useEffect(() => {
    async function fetchDocuments() {
      if (!id) return
      try {
        const docs = await window.api.documents.getByProject(id)
        // Filter to only show project-level documents (not task-bound)
        setDocuments(docs.filter(d => d.task_id === null))
      } catch (err) {
        console.error('Failed to fetch documents:', err)
      }
    }
    fetchDocuments()
  }, [id])

  const project = projects.find((p) => p.id === id)
  const projectTasks = tasks.filter((t) => t.project_id === id && !t.parent_task_id)

  // Filter tasks based on selected filter
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'deleted') return deletedTasks
    if (taskFilter === 'all') {
      // Sort: active tasks first (todo, in_progress), then done
      return [...projectTasks].sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        return 0
      })
    }
    if (taskFilter === 'active') return projectTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
    return projectTasks.filter((t) => t.status === taskFilter)
  }, [projectTasks, deletedTasks, taskFilter])

  // Count tasks by status for filter badges
  const taskCounts = useMemo(() => ({
    all: projectTasks.length,
    active: projectTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length,
    todo: projectTasks.filter((t) => t.status === 'todo').length,
    in_progress: projectTasks.filter((t) => t.status === 'in_progress').length,
    done: projectTasks.filter((t) => t.status === 'done').length,
    deleted: deletedTasks.length
  }), [projectTasks, deletedTasks])

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !id) return

    try {
      const newTask = await createTask({
        project_id: id,
        parent_task_id: null,
        title: newTaskTitle.trim(),
        description: null,
        status: 'todo',
        order: projectTasks.length
      })
      setNewTaskTitle('')
      setIsAddingTask(false)
      setSelectedTask(newTask)
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  const handleToggleStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done'
      await updateTask(task.id, { status: newStatus })
    } catch (err) {
      console.error('Failed to toggle task status:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId)
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleRestoreTask = async (taskId: string) => {
    try {
      await restoreTask(taskId)
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      await updateTask(taskId, { status })
    } catch (err) {
      console.error('Failed to update task status:', err)
    }
  }

  const handleUploadDocument = async () => {
    if (!id) return
    setIsUploading(true)
    try {
      const result = await window.api.documents.upload(null, id)
      if (result === null) return // User cancelled

      if (result.success) {
        const docs = await window.api.documents.getByProject(id)
        setDocuments(docs.filter(d => d.task_id === null))
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

        setDocuments((prev) => prev.map((d) => (d.id === documentId ? doc : d)))

        if (doc.processing_status === 'processing' || doc.processing_status === 'pending') {
          setTimeout(checkStatus, 1000)
        } else if (doc.processing_status === 'failed') {
          console.error(`Failed to process "${doc.name}"`)
        }
      } catch (err) {
        console.error('Failed to check document status:', err)
      }
    }
    setTimeout(checkStatus, 500)
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      await window.api.documents.delete(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  const canPreviewDoc = (fileType: string) => {
    return fileType.startsWith('image/') ||
           fileType === 'application/pdf' ||
           fileType.startsWith('text/') ||
           fileType === 'application/json'
  }

  const handlePreviewDocument = async (doc: Document) => {
    if (!canPreviewDoc(doc.file_type)) {
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

  // Handle ESC key to close preview modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && preview.isOpen) {
        closePreview()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [preview.isOpen])

  const handleDeleteProject = async () => {
    if (!id) return
    try {
      await deleteProject(id)
      navigate('/')
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image size={14} />
    if (fileType.includes('pdf') || fileType.includes('document')) return <FileText size={14} />
    return <File size={14} />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full bg-helm-surface rounded-2xl">
        <div className="text-center">
          <p className="text-helm-text-muted mb-4">Project not found</p>
          <Link to="/" className="text-helm-primary hover:underline">
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-3">
      {/* Main content - Task list or Kanban */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto p-6 bg-helm-surface rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-helm-text truncate">{project.name}</h1>

          {/* View toggle */}
          <div className="flex bg-helm-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-helm-primary text-white' : 'text-helm-text-muted hover:text-helm-text'}`}
              title="List view"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-helm-primary text-white' : 'text-helm-text-muted hover:text-helm-text'}`}
              title="Kanban view"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {/* Task filter tabs */}
        <div className="flex items-center gap-1 mb-4">
          <Filter size={14} className="text-helm-text-muted mr-1" />
          {([
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'done', label: 'Done' },
            { value: 'deleted', label: 'Deleted' }
          ] as const).map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTaskFilter(filter.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                taskFilter === filter.value
                  ? 'bg-helm-primary text-white'
                  : 'bg-helm-surface text-helm-text-muted hover:text-helm-text'
              }`}
            >
              {filter.label}
              <span className={`ml-1.5 ${taskFilter === filter.value ? 'text-white/70' : 'text-helm-text-muted'}`}>
                {taskCounts[filter.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Add task input */}
        <div className="mb-4">
          {isAddingTask ? (
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task title..."
                autoFocus
                className="flex-1 px-4 py-2 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false)
                  setNewTaskTitle('')
                }}
                className="px-4 py-2 text-helm-text-muted hover:text-helm-text transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="flex items-center gap-2 px-4 py-2 text-helm-text-muted hover:text-helm-text hover:bg-helm-surface rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add task...
            </button>
          )}
        </div>

        {/* Task list or Kanban */}
        {viewMode === 'list' ? (
          <ListView
            tasks={filteredTasks}
            onToggle={handleToggleStatus}
            onDelete={handleDeleteTask}
            onRestore={handleRestoreTask}
            onSelect={setSelectedTask}
            isDeleted={taskFilter === 'deleted'}
          />
        ) : (
          <KanbanView
            tasks={filteredTasks}
            onUpdateStatus={handleUpdateTaskStatus}
            onDelete={handleDeleteTask}
            onSelect={setSelectedTask}
          />
        )}
      </div>

      {/* Task detail panel */}
      {selectedTask && id && (
        <TaskDetailPanel
          task={selectedTask}
          projectId={id}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Right panel - Project info (hidden when task selected) */}
      {!selectedTask && (
      <aside className="w-80 flex-shrink-0 bg-helm-surface rounded-2xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Why */}
          <div>
            <h3 className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2">
              Why
            </h3>
            <p className="text-sm text-helm-text">
              {project.why || 'No purpose defined yet'}
            </p>
          </div>

          {/* Done is */}
          <div>
            <h3 className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2">
              Done is
            </h3>
            <p className="text-sm text-helm-text">
              {project.done_definition || 'No success criteria defined yet'}
            </p>
          </div>

          {/* Progress */}
          <div>
            <h3 className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2">
              Progress
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-helm-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-helm-primary transition-all"
                  style={{
                    width: `${projectTasks.length > 0 ? Math.round((projectTasks.filter(t => t.status === 'done').length / projectTasks.length) * 100) : 0}%`
                  }}
                />
              </div>
              <span className="text-sm text-helm-text-muted">
                {projectTasks.filter(t => t.status === 'done').length}/{projectTasks.length}
              </span>
            </div>
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
                    className={`flex items-center gap-2 p-2 bg-helm-bg border rounded-lg group ${
                      doc.processing_status === 'failed'
                        ? 'border-helm-error/50'
                        : doc.processing_status === 'processing' || doc.processing_status === 'pending'
                        ? 'border-helm-primary/50'
                        : 'border-helm-border'
                    }`}
                  >
                    <span className="text-helm-text-muted flex-shrink-0">{getFileIcon(doc.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs text-helm-text truncate ${
                          doc.processing_status === 'completed' ? 'cursor-pointer hover:text-helm-primary' : ''
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-helm-text-muted">{formatFileSize(doc.file_size)}</span>
                        {doc.processing_status === 'pending' && (
                          <span className="flex items-center gap-1 text-xs text-helm-text-muted">
                            <Loader2 size={10} className="animate-spin" />
                          </span>
                        )}
                        {doc.processing_status === 'processing' && (
                          <span className="flex items-center gap-1 text-xs text-helm-primary">
                            <Loader2 size={10} className="animate-spin" />
                          </span>
                        )}
                        {doc.processing_status === 'completed' && (
                          <CheckCircle2 size={10} className="text-helm-success" />
                        )}
                        {doc.processing_status === 'failed' && (
                          <span title={doc.processing_error || undefined}>
                            <AlertCircle size={10} className="text-helm-error" />
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={handleUploadDocument}
                  disabled={isUploading}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-helm-text-muted hover:text-helm-text bg-helm-bg hover:bg-helm-surface-elevated border border-dashed border-helm-border rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus size={12} />
                      Add project document
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Delete Project */}
          <div className="pt-4 border-t border-helm-border">
            {showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="text-sm text-helm-text">
                  Delete <strong>{project.name}</strong>? This will also delete all tasks and documents.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteProject}
                    className="flex-1 px-3 py-2 bg-helm-error hover:bg-helm-error/90 text-white text-sm rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-3 py-2 text-helm-text-muted hover:text-helm-text text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-helm-text-muted hover:text-helm-error transition-colors"
              >
                <Trash2 size={14} />
                Delete project
              </button>
            )}
          </div>

        </div>

        {/* Jeeves button at bottom */}
        <div className="p-2 border-t border-helm-border">
          <button
            onClick={() => openCopilot({ projectId: id })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-helm-surface-elevated text-sm text-helm-text transition-colors"
          >
            <Sparkles size={16} />
            <span>Ask Jeeves</span>
          </button>
        </div>
      </aside>
      )}

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

interface ListViewProps {
  tasks: Task[]
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onSelect: (task: Task) => void
  isDeleted: boolean
}

function ListView({ tasks, onToggle, onDelete, onRestore, onSelect, isDeleted }: ListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex-1 space-y-2">
        <div className="text-center py-12 text-helm-text-muted">
          <p>{isDeleted ? 'No deleted tasks.' : 'No tasks yet. Add your first task above.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onRestore={onRestore} onSelect={onSelect} isDeleted={isDeleted} />
      ))}
    </div>
  )
}

interface TaskRowProps {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onSelect: (task: Task) => void
  isDeleted: boolean
}

function TaskRow({ task, onToggle, onDelete, onRestore, onSelect, isDeleted }: TaskRowProps) {
  const [isCompleting, setIsCompleting] = useState(false)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (task.status !== 'done') {
      // Completing: show animation first
      setIsCompleting(true)
      setTimeout(() => {
        onToggle(task)
        setIsCompleting(false)
      }, 500)
    } else {
      // Uncompleting: just toggle immediately
      onToggle(task)
    }
  }

  return (
    <div
      onClick={() => !isDeleted && !isCompleting && onSelect(task)}
      className={`flex items-center gap-3 p-3 bg-helm-surface border border-helm-border rounded-lg group animate-slide-up transition-colors ${
        isDeleted ? 'opacity-60' : 'cursor-pointer hover:border-helm-primary'
      } ${isCompleting ? 'animate-complete-out' : ''}`}
    >
      {!isDeleted && (
        <button
          onClick={handleToggle}
          disabled={isCompleting}
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            task.status === 'done' || isCompleting
              ? 'bg-helm-success border-helm-success text-white'
              : 'border-helm-border hover:border-helm-primary'
          }`}
        >
          {(task.status === 'done' || isCompleting) && (
            <Check size={12} className={isCompleting ? 'animate-check-pop' : ''} />
          )}
        </button>
      )}
      <span className={`flex-1 text-sm ${task.status === 'done' || isDeleted || isCompleting ? 'text-helm-text-muted line-through' : 'text-helm-text'}`}>
        {task.title}
      </span>
      {!isDeleted && task.status === 'in_progress' && !isCompleting && (
        <span className="text-xs px-2 py-0.5 rounded bg-helm-primary/20 text-helm-primary">
          In Progress
        </span>
      )}
      {isDeleted ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRestore(task.id)
          }}
          className="p-1.5 text-helm-text-muted hover:text-helm-success opacity-0 group-hover:opacity-100 transition-all"
          title="Restore"
        >
          <RotateCcw size={16} />
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task.id)
          }}
          className="p-1.5 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}

interface KanbanViewProps {
  tasks: Task[]
  onUpdateStatus: (id: string, status: Task['status']) => void
  onDelete: (id: string) => void
  onSelect: (task: Task) => void
}

function KanbanView({ tasks, onUpdateStatus, onDelete, onSelect }: KanbanViewProps) {
  const columns: { id: Task['status']; title: string }[] = [
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'done', title: 'Done' }
  ]

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) {
      onUpdateStatus(taskId, status)
    }
  }

  return (
    <div className="flex-1 flex gap-4 pb-4">
      {columns.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.id)
        return (
          <div
            key={column.id}
            className="flex-1 min-w-0 bg-helm-surface rounded-lg p-4 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-helm-text">{column.title}</h3>
              <span className="text-xs text-helm-text-muted bg-helm-surface-elevated px-2 py-0.5 rounded">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2 flex-1 min-h-32">
              {columnTasks.length === 0 ? (
                <p className="text-sm text-helm-text-muted text-center py-8">
                  No tasks
                </p>
              ) : (
                columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onDragStart={handleDragStart}
                    onDelete={onDelete}
                    onSelect={onSelect}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface KanbanCardProps {
  task: Task
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDelete: (id: string) => void
  onSelect: (task: Task) => void
}

function KanbanCard({ task, onDragStart, onDelete, onSelect }: KanbanCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onSelect(task)}
      className="p-3 bg-helm-bg border border-helm-border rounded-lg cursor-grab active:cursor-grabbing group hover:border-helm-primary transition-colors"
    >
      <p className="text-sm text-helm-text">{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-helm-text-muted">
          {new Date(task.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task.id)
          }}
          className="p-1 text-helm-text-muted hover:text-helm-error opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
