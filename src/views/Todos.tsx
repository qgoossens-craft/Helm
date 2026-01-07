import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Calendar, Check } from 'lucide-react'
import { useQuickTodosStore, useUIStore } from '../store'
import type { QuickTodo } from '../types/global'

type TodoList = 'personal' | 'work'

export function Todos() {
  const [activeList, setActiveList] = useState<TodoList>('personal')
  const [newTodo, setNewTodo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { todos, fetchAll, createTodo, updateTodo, deleteTodo, toggleComplete } = useQuickTodosStore()
  const { addToast } = useUIStore()

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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
      addToast('success', 'Todo added')
      setNewTodo('')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleComplete(id)
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTodo(id)
      addToast('success', 'Todo deleted')
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  const handleSetDueDate = async (id: string, date: string | null) => {
    try {
      await updateTodo(id, { due_date: date })
    } catch (err) {
      addToast('error', (err as Error).message)
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-helm-text mb-6">Quick Todos</h1>

      {/* List tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveList('personal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeList === 'personal'
              ? 'bg-helm-primary text-white'
              : 'bg-helm-surface text-helm-text-muted hover:text-helm-text'
          }`}
        >
          Personal
        </button>
        <button
          onClick={() => setActiveList('work')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeList === 'work'
              ? 'bg-helm-primary text-white'
              : 'bg-helm-surface text-helm-text-muted hover:text-helm-text'
          }`}
        >
          Work
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
                onToggle={() => handleToggle(todo.id)}
                onDelete={() => handleDelete(todo.id)}
                onSetDueDate={(date) => handleSetDueDate(todo.id, date)}
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
                    onToggle={() => handleToggle(todo.id)}
                    onDelete={() => handleDelete(todo.id)}
                    onSetDueDate={(date) => handleSetDueDate(todo.id, date)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
      </div>
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
  onToggle: () => void
  onDelete: () => void
  onSetDueDate: (date: string | null) => void
}

function TodoItem({ todo, onToggle, onDelete, onSetDueDate }: TodoItemProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  const handleToggle = () => {
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
      className={`flex items-center gap-3 p-4 bg-helm-surface border rounded-lg group animate-slide-up ${
        todo.completed
          ? 'border-helm-border/50 opacity-60'
          : isOverdue
          ? 'border-helm-error/50'
          : 'border-helm-border'
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

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className={`text-helm-text truncate ${todo.completed || isCompleting ? 'line-through text-helm-text-muted' : ''}`}>
          {todo.title}
        </p>
      </div>

      {/* Due date */}
      <div className="relative">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          disabled={isCompleting}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            todo.due_date
              ? isOverdue && !isCompleting
                ? 'text-helm-error bg-helm-error/10'
                : 'text-helm-text-muted bg-helm-bg'
              : 'text-helm-text-muted opacity-0 group-hover:opacity-100 hover:bg-helm-bg'
          } ${isCompleting ? 'opacity-0' : ''}`}
        >
          <Calendar size={12} />
          {todo.due_date ? formatDueDate(todo.due_date) : 'Set date'}
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
        onClick={onDelete}
        className={`p-2 text-helm-text-muted hover:text-helm-error transition-all ${isCompleting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
        title="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
