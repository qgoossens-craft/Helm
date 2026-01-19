import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Trash2, Calendar, Check } from 'lucide-react'
import { useQuickTodosStore } from '../store'
import { PriorityIndicator } from '../components/PriorityIndicator'
import { PrioritySelector } from '../components/PrioritySelector'
import { RecurrenceSelector, RecurrenceIndicator } from '../components/RecurrenceSelector'
import { QuickTodoDetailPanel } from '../components/QuickTodoDetailPanel'
import type { QuickTodo, RecurrencePattern } from '../types/global'
import type { Priority } from '../lib/priorityConstants'

type TodoList = 'personal' | 'work' | 'tweaks'

export function Todos() {
  const [activeList, setActiveList] = useState<TodoList>('personal')
  const [newTodo, setNewTodo] = useState('')
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { todos, fetchAll, createTodo, updateTodo, deleteTodo, toggleComplete } = useQuickTodosStore()

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Get the selected todo from the store (always up-to-date)
  const selectedTodo = useMemo(() => {
    if (!selectedTodoId) return null
    return todos.find(t => t.id === selectedTodoId) ?? null
  }, [todos, selectedTodoId])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filteredTodos = todos.filter((t) => t.list === activeList)
  const incompleteTodos = filteredTodos.filter((t) => !t.completed)
  const completedTodos = filteredTodos.filter((t) => t.completed)

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim()) return

    try {
      await createTodo({
        title: newTodo.trim(),
        list: activeList
      })
      setNewTodo('')
    } catch (err) {
      console.error('Failed to add todo:', err)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleComplete(id)
    } catch (err) {
      console.error('Failed to toggle todo:', err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTodo(id)
    } catch (err) {
      console.error('Failed to delete todo:', err)
    }
  }

  const handleSetDueDate = async (id: string, date: string | null) => {
    try {
      await updateTodo(id, { due_date: date })
    } catch (err) {
      console.error('Failed to set due date:', err)
    }
  }

  const handleSetPriority = async (id: string, priority: Priority | null) => {
    try {
      await updateTodo(id, { priority })
    } catch (err) {
      console.error('Failed to set priority:', err)
    }
  }

  const handleSetRecurrence = async (
    id: string,
    pattern: RecurrencePattern | null,
    config: string | null,
    endDate: string | null
  ) => {
    try {
      await updateTodo(id, {
        recurrence_pattern: pattern,
        recurrence_config: config,
        recurrence_end_date: endDate
      })
    } catch (err) {
      console.error('Failed to set recurrence:', err)
    }
  }

  return (
    <div className="h-full flex gap-3">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 bg-helm-surface rounded-2xl">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-semibold text-helm-text mb-6">Quick Todos</h1>

      {/* List tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveList('personal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeList === 'personal'
              ? 'bg-helm-primary text-white'
              : 'bg-helm-bg border border-helm-border text-helm-text-muted hover:text-helm-text'
          }`}
        >
          Personal
        </button>
        <button
          onClick={() => setActiveList('work')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeList === 'work'
              ? 'bg-helm-primary text-white'
              : 'bg-helm-bg border border-helm-border text-helm-text-muted hover:text-helm-text'
          }`}
        >
          Work
        </button>
        <button
          onClick={() => setActiveList('tweaks')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeList === 'tweaks'
              ? 'bg-helm-primary text-white'
              : 'bg-helm-bg border border-helm-border text-helm-text-muted hover:text-helm-text'
          }`}
        >
          Tweaks
        </button>
      </div>

      {/* Add todo input */}
      <form onSubmit={handleAddTodo} className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Plus size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-helm-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder={`Add ${activeList} todo...`}
              className="w-full pl-10 pr-4 py-3 bg-helm-surface border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors"
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

          {/* Todo list */}
          <div className="space-y-2">
            {incompleteTodos.length === 0 && completedTodos.length === 0 ? (
              <EmptyState list={activeList} />
            ) : (
              <>
                {incompleteTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    isSelected={selectedTodo?.id === todo.id}
                    onSelect={() => setSelectedTodoId(todo.id)}
                    onToggle={() => handleToggle(todo.id)}
                    onDelete={() => handleDelete(todo.id)}
                    onSetDueDate={(date) => handleSetDueDate(todo.id, date)}
                    onSetPriority={(priority) => handleSetPriority(todo.id, priority)}
                    onSetRecurrence={(pattern, config, endDate) => handleSetRecurrence(todo.id, pattern, config, endDate)}
                  />
                ))}

                {completedTodos.length > 0 && (
                  <>
                    <div className="pt-4 pb-2">
                      <span className="text-xs text-helm-text-muted uppercase tracking-wider">
                        Completed
                      </span>
                    </div>
                    {completedTodos.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        isSelected={selectedTodo?.id === todo.id}
                        onSelect={() => setSelectedTodoId(todo.id)}
                        onToggle={() => handleToggle(todo.id)}
                        onDelete={() => handleDelete(todo.id)}
                        onSetDueDate={(date) => handleSetDueDate(todo.id, date)}
                        onSetPriority={(priority) => handleSetPriority(todo.id, priority)}
                        onSetRecurrence={(pattern, config, endDate) => handleSetRecurrence(todo.id, pattern, config, endDate)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedTodo && (
        <QuickTodoDetailPanel
          todo={selectedTodo}
          onClose={() => setSelectedTodoId(null)}
        />
      )}
    </div>
  )
}

function EmptyState({ list }: { list: TodoList }) {
  return (
    <div className="text-center py-12 text-helm-text-muted">
      <p className="text-lg mb-2">No {list} todos yet.</p>
      <p className="text-sm">Add quick tasks that don't belong to a project.</p>
    </div>
  )
}

interface TodoItemProps {
  todo: QuickTodo
  isSelected: boolean
  onSelect: () => void
  onToggle: () => void
  onDelete: () => void
  onSetDueDate: (date: string | null) => void
  onSetPriority: (priority: Priority | null) => void
  onSetRecurrence: (pattern: RecurrencePattern | null, config: string | null, endDate: string | null) => void
}

function TodoItem({ todo, isSelected, onSelect, onToggle, onDelete, onSetDueDate, onSetPriority, onSetRecurrence }: TodoItemProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const isRecurring = !!todo.recurrence_pattern
  const isInstance = !!todo.recurring_parent_id

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!todo.completed) {
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

  const formatDueDate = (dateStr: string | null): string => {
    if (!dateStr) return ''

    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Reset time for comparison
    today.setHours(0, 0, 0, 0)
    tomorrow.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)

    if (date.getTime() === today.getTime()) return 'Today'
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'

    // Check if within this week
    const dayDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (dayDiff > 0 && dayDiff < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    }

    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const isOverdue = todo.due_date && !todo.completed && new Date(todo.due_date) < new Date(new Date().toDateString())

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 p-4 bg-helm-surface border rounded-lg group animate-slide-up cursor-pointer transition-colors ${
        isSelected
          ? 'border-helm-primary bg-helm-primary/5'
          : todo.completed
          ? 'border-helm-border/50 opacity-60 hover:border-helm-border'
          : isOverdue
          ? 'border-helm-error/50 hover:border-helm-error'
          : 'border-helm-border hover:border-helm-text-muted'
      } ${isCompleting ? 'animate-complete-out' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={isCompleting}
        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          todo.completed || isCompleting
            ? 'bg-helm-success border-helm-success text-white'
            : 'border-helm-border hover:border-helm-primary'
        }`}
      >
        {(todo.completed || isCompleting) && <Check size={14} className={isCompleting ? 'animate-check-pop' : ''} />}
      </button>

      {/* Priority indicator */}
      <PriorityIndicator priority={todo.priority} />

      {/* Title and recurrence indicator */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className={`text-helm-text truncate ${todo.completed || isCompleting ? 'line-through text-helm-text-muted' : ''}`}>
          {todo.title}
        </p>
        {(isRecurring || isInstance) && (
          <RecurrenceIndicator
            pattern={todo.recurrence_pattern}
            isInstance={isInstance}
          />
        )}
      </div>

      {/* Priority selector (on hover) */}
      {!todo.completed && !isCompleting && (
        <div onClick={(e) => e.stopPropagation()} className={`transition-opacity ${isCompleting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
          <PrioritySelector priority={todo.priority} onPriorityChange={onSetPriority} />
        </div>
      )}

      {/* Recurrence selector (on hover) - only for non-instance items */}
      {!todo.completed && !isCompleting && !isInstance && (
        <div onClick={(e) => e.stopPropagation()} className={`transition-opacity ${isCompleting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
          <RecurrenceSelector
            pattern={todo.recurrence_pattern}
            config={todo.recurrence_config}
            endDate={todo.recurrence_end_date}
            onRecurrenceChange={onSetRecurrence}
          />
        </div>
      )}

      {/* Due date */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {/* Show formatted date when set (non-hover) */}
        {todo.due_date && !isCompleting && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs group-hover:hidden whitespace-nowrap ${
            isOverdue ? 'text-helm-error bg-helm-error/10' : 'text-helm-text-muted bg-helm-bg'
          }`}>
            <Calendar size={12} />
            {formatDueDate(todo.due_date)}
          </div>
        )}
        {/* Icon-only button (on hover or when no date) */}
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          disabled={isCompleting}
          className={`p-1 rounded transition-colors hover:bg-helm-surface-elevated ${
            todo.due_date
              ? `hidden group-hover:block ${isOverdue ? 'text-helm-error' : 'text-helm-primary'}`
              : 'text-helm-primary opacity-0 group-hover:opacity-100'
          } ${isCompleting ? 'opacity-0' : ''}`}
          title={todo.due_date ? `Due: ${formatDueDate(todo.due_date)}` : 'Set due date'}
        >
          <Calendar size={14} />
        </button>

        {showDatePicker && (
          <div className="absolute right-0 top-full mt-1 bg-helm-surface border border-helm-border rounded-lg shadow-lg p-2 z-10">
            <input
              type="date"
              value={todo.due_date || ''}
              onChange={(e) => {
                onSetDueDate(e.target.value || null)
                setShowDatePicker(false)
              }}
              className="bg-helm-bg border border-helm-border rounded px-2 py-1 text-sm text-helm-text"
            />
            {todo.due_date && (
              <button
                onClick={() => {
                  onSetDueDate(null)
                  setShowDatePicker(false)
                }}
                className="block w-full mt-1 text-xs text-helm-text-muted hover:text-helm-error"
              >
                Clear date
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className={`p-1 text-helm-primary hover:text-helm-error transition-colors ${isCompleting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
