import { useState, useCallback, useRef } from 'react'
import { Check, Loader2, ListChecks, Plus, AlertCircle, X } from 'lucide-react'
import type { SubtaskSuggestion } from '../../types/global'
import { useTasksStore } from '../../store'

interface SubtaskSuggestionsProps {
  /** Array of subtask suggestions from the AI */
  suggestions: SubtaskSuggestion[]
  /** The parent task ID to create subtasks under */
  parentTaskId: string
  /** Optional callback when subtasks are created */
  onSubtasksCreated?: () => void
}

interface SuggestionState {
  /** Whether this suggestion is selected (checked) */
  selected: boolean
  /** Whether this suggestion has been created */
  created: boolean
  /** Whether this suggestion is currently being created */
  creating: boolean
  /** Error message if creation failed */
  error?: string
}

/**
 * Component to display and manage subtask suggestions from the AI.
 * Allows users to select and create subtasks individually or in bulk.
 */
export function SubtaskSuggestions({
  suggestions,
  parentTaskId,
  onSubtasksCreated
}: SubtaskSuggestionsProps) {
  // Track state for each suggestion by index
  const [suggestionStates, setSuggestionStates] = useState<SuggestionState[]>(
    suggestions.map(() => ({ selected: false, created: false, creating: false }))
  )
  const [isBulkCreating, setIsBulkCreating] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // Refs for keyboard navigation
  const checkboxRefs = useRef<(HTMLButtonElement | null)[]>([])
  const createButtonRef = useRef<HTMLButtonElement>(null)

  const { createTask, getTaskById, tasks } = useTasksStore()

  // Get parent task to inherit project_id
  const parentTask = getTaskById(parentTaskId) || tasks.find(t => t.id === parentTaskId)

  // Toggle selection for a suggestion
  const toggleSelection = useCallback((index: number) => {
    setSuggestionStates(prev => {
      const newStates = [...prev]
      if (!newStates[index].created) {
        newStates[index] = { ...newStates[index], selected: !newStates[index].selected }
      }
      return newStates
    })
  }, [])

  // Clear error for a specific suggestion
  const clearError = useCallback((index: number) => {
    setSuggestionStates(prev => {
      const newStates = [...prev]
      newStates[index] = { ...newStates[index], error: undefined }
      return newStates
    })
  }, [])

  // Create a single subtask
  const createSubtask = useCallback(async (index: number) => {
    const suggestion = suggestions[index]
    const state = suggestionStates[index]

    if (state.created || state.creating) return

    // Mark as creating and clear any previous error
    setSuggestionStates(prev => {
      const newStates = [...prev]
      newStates[index] = { ...newStates[index], creating: true, error: undefined }
      return newStates
    })

    try {
      await createTask({
        title: suggestion.title,
        description: suggestion.description || null,
        project_id: parentTask?.project_id || null,
        parent_task_id: parentTaskId,
        status: 'todo',
        priority: null,
        due_date: null,
        category: null,
        order: index,
        deleted_at: null
      })

      // Mark as created
      setSuggestionStates(prev => {
        const newStates = [...prev]
        newStates[index] = { selected: false, created: true, creating: false }
        return newStates
      })

      onSubtasksCreated?.()
    } catch (error) {
      // Show error message inline
      const errorMessage = error instanceof Error ? error.message : 'Failed to create subtask'
      setSuggestionStates(prev => {
        const newStates = [...prev]
        newStates[index] = { ...newStates[index], creating: false, error: errorMessage }
        return newStates
      })
    }
  }, [suggestions, suggestionStates, parentTaskId, parentTask, createTask, onSubtasksCreated])

  // Create all selected subtasks
  const createSelectedSubtasks = useCallback(async () => {
    const selectedIndices = suggestionStates
      .map((state, index) => ({ state, index }))
      .filter(({ state }) => state.selected && !state.created && !state.creating)
      .map(({ index }) => index)

    if (selectedIndices.length === 0) return

    setIsBulkCreating(true)
    setBulkError(null)
    let failedCount = 0

    // Mark all selected as creating and clear errors
    setSuggestionStates(prev => {
      const newStates = [...prev]
      selectedIndices.forEach(index => {
        newStates[index] = { ...newStates[index], creating: true, error: undefined }
      })
      return newStates
    })

    // Create subtasks sequentially to maintain order
    for (const index of selectedIndices) {
      const suggestion = suggestions[index]
      try {
        await createTask({
          title: suggestion.title,
          description: suggestion.description || null,
          project_id: parentTask?.project_id || null,
          parent_task_id: parentTaskId,
          status: 'todo',
          priority: null,
          due_date: null,
          category: null,
          order: index,
          deleted_at: null
        })

        // Mark as created
        setSuggestionStates(prev => {
          const newStates = [...prev]
          newStates[index] = { selected: false, created: true, creating: false }
          return newStates
        })
      } catch (error) {
        failedCount++
        const errorMessage = error instanceof Error ? error.message : 'Failed to create'
        setSuggestionStates(prev => {
          const newStates = [...prev]
          newStates[index] = { ...newStates[index], creating: false, error: errorMessage }
          return newStates
        })
      }
    }

    setIsBulkCreating(false)

    if (failedCount > 0) {
      setBulkError(`Failed to create ${failedCount} subtask${failedCount > 1 ? 's' : ''}`)
    } else {
      onSubtasksCreated?.()
    }
  }, [suggestions, suggestionStates, parentTaskId, parentTask, createTask, onSubtasksCreated])

  // Handle keyboard navigation in checkboxes
  const handleCheckboxKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const state = suggestionStates[index]

    if (e.key === ' ' && !state.created && !state.creating) {
      e.preventDefault()
      toggleSelection(index)
    } else if (e.key === 'Enter' && !state.created && !state.creating) {
      e.preventDefault()
      createSubtask(index)
    }
  }, [suggestionStates, toggleSelection, createSubtask])

  // Count selected items that haven't been created yet
  const selectedCount = suggestionStates.filter(s => s.selected && !s.created).length
  const createdCount = suggestionStates.filter(s => s.created).length
  const allCreated = createdCount === suggestions.length

  return (
    <div className="mt-3 border border-helm-border rounded-lg overflow-hidden bg-helm-surface">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-helm-bg border-b border-helm-border">
        <ListChecks size={16} className="text-helm-primary" />
        <span className="text-sm font-medium text-helm-text">
          Suggested Subtasks
        </span>
        {createdCount > 0 && (
          <span className="text-xs text-helm-text-muted ml-auto">
            {createdCount}/{suggestions.length} created
          </span>
        )}
      </div>

      {/* Suggestions list */}
      <div className="divide-y divide-helm-border">
        {suggestions.map((suggestion, index) => {
          const state = suggestionStates[index]

          return (
            <div key={index}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 ${
                  state.created
                    ? 'bg-helm-success/5'
                    : state.error
                    ? 'bg-helm-error/5'
                    : 'hover:bg-helm-bg/50'
                } transition-colors`}
              >
                {/* Checkbox */}
                <button
                  ref={el => { checkboxRefs.current[index] = el }}
                  onClick={() => toggleSelection(index)}
                  onKeyDown={(e) => handleCheckboxKeyDown(e, index)}
                  disabled={state.created || state.creating}
                  className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-helm-primary focus:ring-offset-1 focus:ring-offset-helm-surface ${
                    state.created
                      ? 'bg-helm-success border-helm-success cursor-default'
                      : state.selected
                      ? 'bg-helm-primary border-helm-primary'
                      : 'border-helm-border hover:border-helm-primary'
                  }`}
                  aria-label={state.created ? 'Created' : state.selected ? 'Deselect' : 'Select'}
                  tabIndex={state.created || state.creating ? -1 : 0}
                >
                  {(state.created || state.selected) && (
                    <Check size={12} className="text-white" />
                  )}
                </button>

                {/* Title and description */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      state.created
                        ? 'text-helm-text-muted line-through'
                        : 'text-helm-text'
                    }`}
                    title={suggestion.title}
                  >
                    {suggestion.title}
                  </p>
                  {suggestion.description && (
                    <p className="text-xs text-helm-text-muted mt-0.5 truncate" title={suggestion.description}>
                      {suggestion.description}
                    </p>
                  )}
                </div>

                {/* Create button or status */}
                {state.creating ? (
                  <Loader2 size={16} className="text-helm-primary animate-spin flex-shrink-0" />
                ) : state.created ? (
                  <Check size={16} className="text-helm-success flex-shrink-0" />
                ) : (
                  <button
                    onClick={() => createSubtask(index)}
                    className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-helm-primary hover:text-white hover:bg-helm-primary border border-helm-primary rounded transition-colors focus:outline-none focus:ring-2 focus:ring-helm-primary"
                  >
                    Create
                  </button>
                )}
              </div>

              {/* Inline error message for this suggestion */}
              {state.error && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-helm-error/10 border-t border-helm-error/20">
                  <AlertCircle size={12} className="text-helm-error flex-shrink-0" />
                  <span className="text-xs text-helm-error flex-1">{state.error}</span>
                  <button
                    onClick={() => clearError(index)}
                    className="p-0.5 text-helm-error hover:bg-helm-error/20 rounded"
                    aria-label="Dismiss error"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer with bulk action */}
      {!allCreated && (
        <div className="px-3 py-2.5 bg-helm-bg border-t border-helm-border">
          {/* Bulk error message */}
          {bulkError && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-helm-error/10 border border-helm-error/20 rounded">
              <AlertCircle size={14} className="text-helm-error flex-shrink-0" />
              <span className="text-xs text-helm-error flex-1">{bulkError}</span>
              <button
                onClick={() => setBulkError(null)}
                className="p-0.5 text-helm-error hover:bg-helm-error/20 rounded"
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <button
              ref={createButtonRef}
              onClick={createSelectedSubtasks}
              disabled={selectedCount === 0 || isBulkCreating}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-helm-primary ${
                selectedCount > 0 && !isBulkCreating
                  ? 'bg-helm-primary hover:bg-helm-primary-hover text-white'
                  : 'bg-helm-bg text-helm-text-muted cursor-not-allowed border border-helm-border'
              }`}
            >
              {isBulkCreating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>
                    Create Selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* All created message */}
      {allCreated && (
        <div className="px-3 py-2.5 bg-helm-success/10 border-t border-helm-success/20 flex items-center justify-center gap-2">
          <Check size={14} className="text-helm-success" />
          <span className="text-sm text-helm-success">All subtasks created</span>
        </div>
      )}
    </div>
  )
}
