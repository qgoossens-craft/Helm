import { X, CheckSquare } from 'lucide-react'
import type { Task } from '../../types/global'

interface TaskMentionChipProps {
  /** The linked task to display */
  task: Task
  /** Callback when the chip is removed */
  onRemove: () => void
}

/**
 * Compact chip component displaying a linked task in the Copilot chat.
 * Shows the task title with an X button for removal.
 * Styled with a blue/primary tinted background.
 */
export function TaskMentionChip({ task, onRemove }: TaskMentionChipProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-helm-primary/15 border border-helm-primary/30 rounded-full text-sm max-w-[300px]">
      {/* Task icon */}
      <CheckSquare size={12} className="text-helm-primary flex-shrink-0" />

      {/* Task title - truncated if too long */}
      <span className="truncate text-helm-text">{task.title}</span>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="p-0.5 rounded-full hover:bg-helm-primary/20 transition-colors flex-shrink-0"
        title="Remove linked task"
        aria-label="Remove linked task"
      >
        <X size={12} className="text-helm-text-muted hover:text-helm-text" />
      </button>
    </div>
  )
}
