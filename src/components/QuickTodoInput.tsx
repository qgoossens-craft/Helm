import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { useQuickTodosStore } from '../store'

type TodoList = 'personal' | 'work' | 'tweaks'

interface QuickTodoInputProps {
  dueDate: string // YYYY-MM-DD format
}

const LIST_CONFIG: Record<TodoList, { label: string; color: string }> = {
  personal: { label: 'Personal', color: 'bg-blue-500' },
  work: { label: 'Work', color: 'bg-amber-500' },
  tweaks: { label: 'Tweaks', color: 'bg-purple-500' }
}

const STORAGE_KEY = 'dayview-last-list'

export function QuickTodoInput({ dueDate }: QuickTodoInputProps) {
  const [title, setTitle] = useState('')
  const [selectedList, setSelectedList] = useState<TodoList>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved as TodoList) || 'personal'
  })
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { createTodo } = useQuickTodosStore()

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createTodo({
        title: title.trim(),
        list: selectedList,
        due_date: dueDate
      })
      setTitle('')
    } catch (err) {
      console.error('Failed to create todo:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setTitle('')
      inputRef.current?.blur()
    }
  }

  const handleListSelect = (list: TodoList) => {
    setSelectedList(list)
    localStorage.setItem(STORAGE_KEY, list)
    setShowDropdown(false)
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-helm-bg border border-helm-border rounded-lg">
      {/* Plus icon */}
      <Plus size={18} className="text-helm-text-muted flex-shrink-0" />

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a quick todo..."
        className="flex-1 bg-transparent text-helm-text placeholder:text-helm-text-muted focus:outline-none"
        disabled={isSubmitting}
      />

      {/* List selector dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-helm-surface-elevated transition-colors"
          disabled={isSubmitting}
        >
          <span className={`w-2 h-2 rounded-full ${LIST_CONFIG[selectedList].color}`} />
          <span className="text-sm text-helm-text-muted">{LIST_CONFIG[selectedList].label}</span>
          <ChevronDown size={14} className="text-helm-text-muted" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 bottom-full mb-1 bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg z-50 min-w-[140px] overflow-hidden py-1">
            {(Object.keys(LIST_CONFIG) as TodoList[]).map((list) => (
              <button
                key={list}
                onClick={() => handleListSelect(list)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
                  selectedList === list ? 'text-helm-primary' : 'text-helm-text'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${LIST_CONFIG[list].color}`} />
                {LIST_CONFIG[list].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
