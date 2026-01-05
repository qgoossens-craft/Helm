import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { List, LayoutGrid, Plus, Check, MoreHorizontal, Trash2, FileText, Image, File, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { useProjectsStore, useTasksStore, useUIStore } from '../store'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import type { Task, Document } from '../types/global'

type ViewMode = 'list' | 'kanban'
type TaskFilter = 'all' | 'todo' | 'in_progress' | 'done'

export function Project() {
  const { id } = useParams<{ id: string }>()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showDocuments, setShowDocuments] = useState(true)

  const { projects, fetchProjects } = useProjectsStore()
  const { tasks, fetchTasksByProject, createTask, updateTask, deleteTask } = useTasksStore()
  const { addToast } = useUIStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (id) {
      fetchTasksByProject(id)
    }
  }, [id, fetchTasksByProject])

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
    if (taskFilter === 'all') return projectTasks
    return projectTasks.filter((t) => t.status === taskFilter)
  }, [projectTasks, taskFilter])

  // Count tasks by status for filter badges
  const taskCounts = useMemo(() => ({
    all: projectTasks.length,
    todo: projectTasks.filter((t) => t.status === 'todo').length,
    in_progress: projectTasks.filter((t) => t.status === 'in_progress').length,
    done: projectTasks.filter((t) => t.status === 'done').length
  }), [projectTasks])

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
      addToast('error', (err as Error).message)
    }
  }

  const handleToggleStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done'
      await updateTask(task.id, { status: newStatus })
      addToast('success', newStatus === 'done' ? 'Task completed!' : 'Task reopened')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      addToast('success', 'Task deleted')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      await updateTask(taskId, { status })
      const statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }
      addToast('success', `Moved to ${statusLabels[status]}`)
    } catch (err) {
      addToast('error', (err as Error).message)
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
        addToast('success', 'Document uploaded and processing')
        pollDocumentStatus(result.documentId)
      } else {
        addToast('error', result.error || 'Failed to upload document')
      }
    } catch (err) {
      addToast('error', 'Failed to upload document')
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
        } else if (doc.processing_status === 'completed') {
          addToast('success', `"${doc.name}" ready for AI assistance`)
        } else if (doc.processing_status === 'failed') {
          addToast('error', `Failed to process "${doc.name}"`)
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
      addToast('success', 'Document removed')
    } catch (err) {
      addToast('error', 'Failed to delete document')
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
      <div className="flex items-center justify-center h-full">
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
    <div className="flex h-full gap-6">
      {/* Main content - Task list or Kanban */}
      <div className="flex-1 flex flex-col min-w-0">
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
            { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'done', label: 'Done' }
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
            onSelect={setSelectedTask}
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
      <aside className="w-80 flex-shrink-0 border-l border-helm-border pl-6">
        <div className="space-y-6">
          {/* Status */}
          <div>
            <h3 className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2">
              Status
            </h3>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              project.status === 'active' ? 'bg-helm-success/20 text-helm-success' :
              project.status === 'paused' ? 'bg-yellow-500/20 text-yellow-500' :
              project.status === 'completed' ? 'bg-helm-primary/20 text-helm-primary' :
              'bg-helm-surface-elevated text-helm-text-muted'
            }`}>
              {project.status}
            </span>
          </div>

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
                      <p className="text-xs text-helm-text truncate">{doc.name}</p>
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

        </div>
      </aside>
      )}
    </div>
  )
}

interface ListViewProps {
  tasks: Task[]
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onSelect: (task: Task) => void
}

function ListView({ tasks, onToggle, onDelete, onSelect }: ListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex-1 space-y-2">
        <div className="text-center py-12 text-helm-text-muted">
          <p>No tasks yet. Add your first task above.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onSelect={onSelect} />
      ))}
    </div>
  )
}

interface TaskRowProps {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onSelect: (task: Task) => void
}

function TaskRow({ task, onToggle, onDelete, onSelect }: TaskRowProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      onClick={() => onSelect(task)}
      className="flex items-center gap-3 p-3 bg-helm-surface border border-helm-border rounded-lg group animate-slide-up cursor-pointer hover:border-helm-primary transition-colors"
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle(task)
        }}
        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          task.status === 'done'
            ? 'bg-helm-primary border-helm-primary text-white'
            : 'border-helm-border hover:border-helm-primary'
        }`}
      >
        {task.status === 'done' && <Check size={12} />}
      </button>
      <span className={`flex-1 text-sm ${task.status === 'done' ? 'text-helm-text-muted line-through' : 'text-helm-text'}`}>
        {task.title}
      </span>
      {task.status === 'in_progress' && (
        <span className="text-xs px-2 py-0.5 rounded bg-helm-primary/20 text-helm-primary">
          In Progress
        </span>
      )}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-1.5 text-helm-text-muted hover:text-helm-text hover:bg-helm-surface-elevated rounded opacity-0 group-hover:opacity-100 transition-all"
        >
          <MoreHorizontal size={16} />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0" onClick={(e) => {
              e.stopPropagation()
              setShowMenu(false)
            }} />
            <div className="absolute right-0 top-8 bg-helm-surface border border-helm-border rounded-lg shadow-lg py-1 z-10 min-w-32 animate-scale-in">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(task.id)
                  setShowMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-helm-error hover:bg-helm-surface-elevated flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
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
    <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.id)
        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-72 bg-helm-surface rounded-lg p-4 flex flex-col"
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
          {new Date(task.created_at).toLocaleDateString()}
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
