import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Trash2, ArrowRight, Check, FolderKanban, ListTodo, Briefcase, User, Wrench, ChevronDown, Inbox as InboxIcon } from 'lucide-react'
import { useTasksStore, useProjectsStore, useUIStore, useQuickTodosStore } from '../store'
import { PriorityIndicator } from '../components/PriorityIndicator'
import { PrioritySelector } from '../components/PrioritySelector'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import type { Task } from '../types/global'
import type { Priority } from '../lib/priorityConstants'

type TargetList = 'inbox' | 'personal' | 'work' | 'tweaks'

export function Inbox() {
  const [newItem, setNewItem] = useState('')
  const [targetList, setTargetList] = useState<TargetList>('inbox')
  const [showListSelector, setShowListSelector] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listSelectorRef = useRef<HTMLDivElement>(null)
  const { inboxTasks, fetchInbox, createTask, updateTask, deleteTask } = useTasksStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { openMoveToProject } = useUIStore()
  const { createTodo } = useQuickTodosStore()

  useEffect(() => {
    fetchInbox()
    fetchProjects()
  }, [fetchInbox, fetchProjects])

  // Get the selected task from the store (always up-to-date)
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null
    return inboxTasks.find(t => t.id === selectedTaskId) ?? null
  }, [inboxTasks, selectedTaskId])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close list selector when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (listSelectorRef.current && !listSelectorRef.current.contains(e.target as Node)) {
        setShowListSelector(false)
      }
    }
    if (showListSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showListSelector])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return

    try {
      if (targetList === 'inbox') {
        // Create as inbox task
        await createTask({
          project_id: null,
          parent_task_id: null,
          title: newItem.trim(),
          description: null,
          status: 'todo',
          order: inboxTasks.length
        })
      } else {
        // Create directly as QuickTodo
        await createTodo({
          title: newItem.trim(),
          list: targetList
        })
      }
      setNewItem('')
    } catch (err) {
      console.error('Failed to add item:', err)
    }
  }

  const listOptions: { value: TargetList; label: string; icon: React.ReactNode }[] = [
    { value: 'inbox', label: 'Inbox', icon: <InboxIcon size={14} /> },
    { value: 'personal', label: 'Personal', icon: <User size={14} /> },
    { value: 'work', label: 'Work', icon: <Briefcase size={14} /> },
    { value: 'tweaks', label: 'Tweaks', icon: <Wrench size={14} /> }
  ]

  const selectedListOption = listOptions.find(opt => opt.value === targetList)!

  const handleToggleComplete = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done'
      await updateTask(id, { status: newStatus })
    } catch (err) {
      console.error('Failed to toggle complete:', err)
    }
  }

  // Filter into incomplete and completed
  const incompleteItems = inboxTasks.filter((t) => t.status !== 'done')
  const completedItems = inboxTasks.filter((t) => t.status === 'done')

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id)
    } catch (err) {
      console.error('Failed to delete item:', err)
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
    <div className="h-full flex gap-3">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 bg-helm-surface rounded-2xl">
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
                  placeholder="Add item..."
                  className="w-full pl-10 pr-4 py-3 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors"
                />
              </div>
              {/* List selector dropdown */}
              <div className="relative" ref={listSelectorRef}>
                <button
                  type="button"
                  onClick={() => setShowListSelector(!showListSelector)}
                  className="flex items-center gap-2 px-3 py-3 bg-helm-surface border border-helm-border rounded-lg text-helm-text hover:border-helm-text-muted transition-colors"
                >
                  {selectedListOption.icon}
                  <span className="text-sm">{selectedListOption.label}</span>
                  <ChevronDown size={14} className={`text-helm-text-muted transition-transform ${showListSelector ? 'rotate-180' : ''}`} />
                </button>
                {showListSelector && (
                  <div className="absolute right-0 top-full mt-1 bg-helm-surface border border-helm-border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                    {listOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setTargetList(opt.value)
                          setShowListSelector(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                          targetList === opt.value
                            ? 'bg-helm-primary/10 text-helm-primary'
                            : 'text-helm-text hover:bg-helm-surface-elevated'
                        }`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
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
                    task={task}
                    isSelected={selectedTask?.id === task.id}
                    createdAt={formatDate(task.created_at)}
                    onSelect={() => setSelectedTaskId(task.id)}
                    onToggle={() => handleToggleComplete(task.id, task.status)}
                    onMove={() => openMoveToProject(task.id)}
                    onDelete={() => handleDelete(task.id)}
                    onPriorityChange={(priority) => updateTask(task.id, { priority })}
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
                        task={task}
                        isSelected={selectedTask?.id === task.id}
                        createdAt={formatDate(task.created_at)}
                        onSelect={() => setSelectedTaskId(task.id)}
                        onToggle={() => handleToggleComplete(task.id, task.status)}
                        onMove={() => openMoveToProject(task.id)}
                        onDelete={() => handleDelete(task.id)}
                        onPriorityChange={(priority) => updateTask(task.id, { priority })}
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

      {/* Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          projectId={null}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
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
  task: Task
  isSelected: boolean
  createdAt: string
  onSelect: () => void
  onToggle: () => void
  onMove: () => void
  onDelete: () => void
  onPriorityChange: (priority: Priority | null) => void
}

function InboxItem({ task, isSelected, createdAt, onSelect, onToggle, onMove, onDelete, onPriorityChange }: InboxItemProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const completed = task.status === 'done'

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
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

  const handleClick = () => {
    if (!isCompleting) {
      onSelect()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 p-4 bg-helm-surface border rounded-lg group animate-slide-up cursor-pointer transition-colors ${
        isSelected
          ? 'border-helm-primary bg-helm-primary/5'
          : completed
          ? 'border-helm-border/50 opacity-60 hover:border-helm-border'
          : 'border-helm-border hover:border-helm-text-muted'
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
      <PriorityIndicator priority={task.priority} />
      <div className="flex-1 min-w-0">
        <p className={`truncate ${completed || isCompleting ? 'line-through text-helm-text-muted' : 'text-helm-text'}`}>{task.title}</p>
        <p className="text-xs text-helm-text-muted">{createdAt}</p>
      </div>
      <div className={`flex gap-1 items-center transition-opacity ${isCompleting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
        {!completed && !isCompleting && (
          <>
            <PrioritySelector priority={task.priority} onPriorityChange={onPriorityChange} />
            <button
              onClick={(e) => { e.stopPropagation(); onMove() }}
              className="p-2 text-helm-text-muted hover:text-helm-text hover:bg-helm-surface-elevated rounded transition-colors"
              title="Move to project"
            >
              <ArrowRight size={16} />
            </button>
          </>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
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
  const { isMoveToProjectOpen, moveTaskId, closeMoveToProject } = useUIStore()
  const { moveToProject, getTaskById, deleteTask } = useTasksStore()
  const { createTodo } = useQuickTodosStore()

  if (!isMoveToProjectOpen || !moveTaskId) return null

  const task = getTaskById(moveTaskId)

  const handleMoveToProject = async (projectId: string) => {
    try {
      await moveToProject(moveTaskId, projectId)
      closeMoveToProject()
    } catch (err) {
      console.error('Failed to move to project:', err)
    }
  }

  const handleMoveToTodos = async (list: 'personal' | 'work' | 'tweaks') => {
    if (!task) return
    try {
      await createTodo({ title: task.title, list })
      await deleteTask(moveTaskId)
      closeMoveToProject()
    } catch (err) {
      console.error('Failed to move to todos:', err)
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
            <button
              onClick={() => handleMoveToTodos('tweaks')}
              className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg bg-helm-bg hover:bg-helm-surface-elevated text-helm-text transition-colors"
            >
              <Wrench size={16} className="text-helm-text-muted" />
              Tweaks
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
