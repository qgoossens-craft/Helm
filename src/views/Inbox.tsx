import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ArrowRight, Check, FolderKanban, ListTodo, Briefcase, User } from 'lucide-react'
import { useTasksStore, useProjectsStore, useUIStore, useQuickTodosStore } from '../store'

export function Inbox() {
  const [newItem, setNewItem] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { inboxTasks, fetchInbox, createTask, updateTask, deleteTask } = useTasksStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { openMoveToProject, addToast } = useUIStore()

  useEffect(() => {
    fetchInbox()
    fetchProjects()
  }, [fetchInbox, fetchProjects])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    try {
      await createTask({
        project_id: null,
        parent_task_id: null,
        title: newItem.trim(),
        description: null,
        status: 'todo',
        order: inboxTasks.length
      })
      addToast('success', 'Item added to inbox')
      setNewItem('')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const handleToggleComplete = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done'
      await updateTask(id, { status: newStatus })
      addToast('success', newStatus === 'done' ? 'Item completed' : 'Item restored')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  // Filter into incomplete and completed
  const incompleteItems = inboxTasks.filter((t) => t.status !== 'done')
  const completedItems = inboxTasks.filter((t) => t.status === 'done')

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id)
      addToast('success', 'Item deleted')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-helm-text mb-6">Inbox</h1>

      {/* Quick capture input */}
      <form onSubmit={handleAddItem} className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Plus size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-helm-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add item... (Cmd+N)"
              className="w-full pl-10 pr-4 py-3 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-3 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      {/* Inbox items */}
      <div className="space-y-2">
        {incompleteItems.length === 0 && completedItems.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {incompleteItems.map((task) => (
              <InboxItem
                key={task.id}
                title={task.title}
                completed={false}
                createdAt={formatDate(task.created_at)}
                onToggle={() => handleToggleComplete(task.id, task.status)}
                onMove={() => openMoveToProject(task.id)}
                onDelete={() => handleDelete(task.id)}
              />
            ))}

            {completedItems.length > 0 && (
              <>
                <p className="text-xs font-medium text-helm-text-muted uppercase tracking-wider pt-4 pb-2">
                  Completed
                </p>
                {completedItems.map((task) => (
                  <InboxItem
                    key={task.id}
                    title={task.title}
                    completed={true}
                    createdAt={formatDate(task.created_at)}
                    onToggle={() => handleToggleComplete(task.id, task.status)}
                    onMove={() => openMoveToProject(task.id)}
                    onDelete={() => handleDelete(task.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Move to project modal */}
      <MoveToProjectModal projects={projects.filter((p) => !p.archived_at)} />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-helm-text-muted">
      <p className="text-lg mb-2">Nothing here. That's a good thing.</p>
      <p className="text-sm">Capture ideas quickly and sort them later.</p>
    </div>
  )
}

interface InboxItemProps {
  title: string
  completed: boolean
  createdAt: string
  onToggle: () => void
  onMove: () => void
  onDelete: () => void
}

function InboxItem({ title, completed, createdAt, onToggle, onMove, onDelete }: InboxItemProps) {
  const [isCompleting, setIsCompleting] = useState(false)

  const handleToggle = () => {
    if (!completed) {
      // Completing: show animation first
      setIsCompleting(true)
      setTimeout(() => {
        onToggle()
        setIsCompleting(false)
      }, 500)
    } else {
      // Uncompleting: just toggle immediately
      onToggle()
    }
  }

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-helm-surface border rounded-lg group animate-slide-up ${
        completed
          ? 'border-helm-border/50 opacity-60'
          : 'border-helm-border'
      } ${isCompleting ? 'animate-complete-out' : ''}`}
    >
      <button
        onClick={handleToggle}
        disabled={isCompleting}
        className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${
          completed || isCompleting
            ? 'bg-helm-success border-helm-success text-white'
            : 'border-helm-border hover:border-helm-primary'
        }`}
        title={completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {(completed || isCompleting) && <Check size={14} className={isCompleting ? 'animate-check-pop' : ''} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`truncate ${completed || isCompleting ? 'line-through text-helm-text-muted' : 'text-helm-text'}`}>{title}</p>
        <p className="text-xs text-helm-text-muted">{createdAt}</p>
      </div>
      <div className={`flex gap-2 transition-opacity ${isCompleting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
        {!completed && !isCompleting && (
          <button
            onClick={onMove}
            className="p-2 text-helm-text-muted hover:text-helm-text hover:bg-helm-surface-elevated rounded transition-colors"
            title="Move to project"
          >
            <ArrowRight size={16} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 text-helm-text-muted hover:text-helm-error hover:bg-helm-surface-elevated rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

interface MoveToProjectModalProps {
  projects: Array<{ id: string; name: string }>
}

function MoveToProjectModal({ projects }: MoveToProjectModalProps) {
  const { isMoveToProjectOpen, moveTaskId, closeMoveToProject, addToast } = useUIStore()
  const { moveToProject, getTaskById, deleteTask } = useTasksStore()
  const { createTodo } = useQuickTodosStore()

  if (!isMoveToProjectOpen || !moveTaskId) return null

  const task = getTaskById(moveTaskId)

  const handleMoveToProject = async (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId)
      await moveToProject(moveTaskId, projectId)
      addToast('success', `Moved to ${project?.name || 'project'}`)
      closeMoveToProject()
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const handleMoveToTodos = async (list: 'personal' | 'work') => {
    if (!task) return
    try {
      await createTodo({ title: task.title, list })
      await deleteTask(moveTaskId)
      addToast('success', `Moved to ${list === 'personal' ? 'Personal' : 'Work'} todos`)
      closeMoveToProject()
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
      <div className="bg-helm-surface border border-helm-border rounded-xl w-full max-w-sm p-6 modal-content">
        <h2 className="text-lg font-medium text-helm-text mb-4">Move to...</h2>

        {/* Todos section */}
        <div className="mb-4">
          <p className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
            <ListTodo size={12} />
            Todos
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleMoveToTodos('personal')}
              className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg bg-helm-bg hover:bg-helm-surface-elevated text-helm-text transition-colors"
            >
              <User size={16} className="text-helm-text-muted" />
              Personal
            </button>
            <button
              onClick={() => handleMoveToTodos('work')}
              className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg bg-helm-bg hover:bg-helm-surface-elevated text-helm-text transition-colors"
            >
              <Briefcase size={16} className="text-helm-text-muted" />
              Work
            </button>
          </div>
        </div>

        {/* Projects section */}
        <div className="mb-4">
          <p className="text-xs font-medium text-helm-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
            <FolderKanban size={12} />
            Projects
          </p>
          {projects.length === 0 ? (
            <p className="text-helm-text-muted text-sm py-2">
              No projects available
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleMoveToProject(project.id)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-helm-bg hover:bg-helm-surface-elevated text-helm-text transition-colors"
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={closeMoveToProject}
          className="w-full px-4 py-2 text-helm-text-muted hover:text-helm-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
