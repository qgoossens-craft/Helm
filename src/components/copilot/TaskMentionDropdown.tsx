import { useEffect, useRef } from 'react'
import { CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'
import type { Task } from '../../types/global'

interface TaskMentionDropdownProps {
  /** Whether the dropdown is visible */
  isVisible: boolean
  /** Search query to filter tasks */
  searchQuery: string
  /** List of tasks to display (already filtered by searchQuery) */
  tasks: Task[]
  /** Currently selected index for keyboard navigation */
  selectedIndex: number
  /** Callback when a task is selected */
  onSelect: (task: Task) => void
  /** Callback when dropdown is dismissed */
  onDismiss: () => void
  /** Map of project IDs to project names for display */
  projectNames: Record<string, string>
  /** Whether tasks are still loading */
  isLoading?: boolean
}

/**
 * Dropdown component for @ mentioning tasks in the Copilot chat.
 * Displays a filterable list of tasks with keyboard navigation support.
 * Positioned above the input field.
 */
export function TaskMentionDropdown({
  isVisible,
  searchQuery,
  tasks,
  selectedIndex,
  onSelect,
  onDismiss,
  projectNames,
  isLoading = false
}: TaskMentionDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  // Handle click outside to dismiss
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onDismiss()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, onDismiss])

  if (!isVisible) return null

  // Get status icon based on task status
  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 size={14} className="text-green-500" />
      case 'in_progress':
        return <Clock size={14} className="text-yellow-500" />
      default:
        return <Circle size={14} className="text-helm-text-muted" />
    }
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-helm-border">
        <span className="text-xs text-helm-text-muted">
          {searchQuery ? `Tasks matching "${searchQuery}"` : 'Link a task'}
        </span>
      </div>

      {/* Task list */}
      <div className="max-h-[240px] overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 flex items-center justify-center gap-2 text-sm text-helm-text-muted">
            <Loader2 size={14} className="animate-spin" />
            <span>Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-helm-text-muted">
            {searchQuery ? 'No tasks found' : 'No tasks available'}
          </div>
        ) : (
          tasks.map((task, index) => (
            <button
              key={task.id}
              ref={index === selectedIndex ? selectedItemRef : null}
              onClick={() => onSelect(task)}
              className={`w-full px-3 py-2 text-left flex items-start gap-2 transition-colors ${
                index === selectedIndex
                  ? 'bg-helm-primary/10 text-helm-text'
                  : 'hover:bg-helm-bg text-helm-text'
              }`}
            >
              {/* Status indicator */}
              <span className="mt-0.5 flex-shrink-0">
                {getStatusIcon(task.status)}
              </span>

              {/* Task content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" title={task.title}>{task.title}</p>
                {task.project_id && projectNames[task.project_id] && (
                  <p className="text-xs text-helm-text-muted truncate">
                    {projectNames[task.project_id]}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-helm-border bg-helm-bg">
        <span className="text-xs text-helm-text-muted">
          <kbd className="px-1 py-0.5 bg-helm-surface rounded text-[10px]">↑↓</kbd>
          {' '}navigate{' '}
          <kbd className="px-1 py-0.5 bg-helm-surface rounded text-[10px]">Enter</kbd>
          /<kbd className="px-1 py-0.5 bg-helm-surface rounded text-[10px]">Space</kbd>
          {' '}select{' '}
          <kbd className="px-1 py-0.5 bg-helm-surface rounded text-[10px]">Tab</kbd>
          /<kbd className="px-1 py-0.5 bg-helm-surface rounded text-[10px]">Esc</kbd>
          {' '}dismiss
        </span>
      </div>
    </div>
  )
}
