import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Inbox, FolderKanban, ListTodo } from 'lucide-react'
import { useUIStore, useTasksStore, useProjectsStore } from '../store'
import type { Task } from '../types/global'


type Category = 'all' | 'projects' | 'inbox' | 'tasks'

interface SearchResult {
  type: 'task' | 'inbox' | 'project'
  id: string
  title: string
  subtitle?: string
  status?: Task['status']
  projectId?: string | null
}

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Search size={14} /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={14} /> },
  { id: 'inbox', label: 'Inbox', icon: <Inbox size={14} /> },
  { id: 'tasks', label: 'Tasks', icon: <ListTodo size={14} /> },
]

export function QuickSwitcher() {
  const { isQuickSwitcherOpen, closeQuickSwitcher } = useUIStore()

  if (!isQuickSwitcherOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[12vh] z-50"
      onClick={closeQuickSwitcher}
    >
      <QuickSwitcherContent onClose={closeQuickSwitcher} />
    </div>
  )
}

function QuickSwitcherContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { tasks, inboxTasks, updateTask } = useTasksStore()
  const { projects } = useProjectsStore()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [category, setCategory] = useState<Category>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastEnterRef = useRef<number>(0)

  // Build search results based on category
  const results: SearchResult[] = (() => {
    const q = query.toLowerCase().trim()
    const items: SearchResult[] = []

    // Add projects (if category allows)
    if (category === 'all' || category === 'projects') {
      projects
        .filter(p => !p.archived_at && p.status !== 'abandoned')
        .filter(p => !q || p.name.toLowerCase().includes(q))
        .forEach(p => {
          items.push({
            type: 'project',
            id: p.id,
            title: p.name,
            subtitle: `${p.status} project`
          })
        })
    }

    // Add inbox tasks (if category allows) - only active ones
    if (category === 'all' || category === 'inbox') {
      inboxTasks
        .filter(t => t.status !== 'done')
        .filter(t => !q || t.title.toLowerCase().includes(q))
        .forEach(t => {
          items.push({
            type: 'inbox',
            id: t.id,
            title: t.title,
            subtitle: 'Inbox',
            status: t.status
          })
        })
    }

    // Add project tasks (if category allows) - only active top-level tasks
    if (category === 'all' || category === 'tasks') {
      tasks
        .filter(t => t.status !== 'done')
        .filter(t => !t.parent_task_id) // Exclude sub-tasks
        .filter(t => !q || t.title.toLowerCase().includes(q))
        .forEach(t => {
          const project = projects.find(p => p.id === t.project_id)
          items.push({
            type: 'task',
            id: t.id,
            title: t.title,
            subtitle: project?.name || 'Unknown project',
            status: t.status,
            projectId: t.project_id
          })
        })
    }

    return items.slice(0, 15)
  })()

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, results.length])

  const handleSelect = useCallback((result: SearchResult) => {
    onClose()
    if (result.type === 'project') {
      navigate(`/project/${result.id}`)
    } else if (result.type === 'inbox') {
      navigate('/inbox')
    } else if (result.type === 'task' && result.projectId) {
      // Navigate to project with task ID to auto-select it
      navigate(`/project/${result.projectId}?task=${result.id}`)
    }
  }, [onClose, navigate])

  const handleToggleComplete = useCallback(async (result: SearchResult) => {
    if (result.type === 'project') return

    try {
      const newStatus = result.status === 'done' ? 'todo' : 'done'
      await updateTask(result.id, { status: newStatus })
    } catch (err) {
      console.error('Failed to toggle task:', err)
    }
  }, [updateTask])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setSelectedIndex(0)
  }

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat)
    setSelectedIndex(0)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Tab': {
        e.preventDefault()
        const currentIdx = CATEGORIES.findIndex(c => c.id === category)
        const nextIdx = e.shiftKey
          ? (currentIdx - 1 + CATEGORIES.length) % CATEGORIES.length
          : (currentIdx + 1) % CATEGORIES.length
        handleCategoryChange(CATEGORIES[nextIdx].id)
        break
      }
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter': {
        e.preventDefault()
        if (results[selectedIndex]) {
          const now = Date.now()
          const timeSinceLastEnter = now - lastEnterRef.current

          if (timeSinceLastEnter < 400 && timeSinceLastEnter > 50) {
            // Double-tap Enter - toggle complete
            handleToggleComplete(results[selectedIndex])
            lastEnterRef.current = 0
          } else {
            // Single Enter - navigate after delay
            lastEnterRef.current = now
            const currentResult = results[selectedIndex]
            setTimeout(() => {
              if (lastEnterRef.current === now) {
                handleSelect(currentResult)
              }
            }, 200)
          }
        }
        break
      }
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [results, selectedIndex, category, handleSelect, handleToggleComplete, onClose])

  return (
    <div
      className="bg-helm-surface border border-helm-border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-in flex"
      onClick={e => e.stopPropagation()}
    >
      {/* Category sidebar */}
      <div className="w-36 bg-helm-bg border-r border-helm-border py-2 shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
              category === cat.id
                ? 'bg-helm-primary text-white'
                : 'text-helm-text-muted hover:bg-helm-surface hover:text-helm-text'
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-helm-border">
          <Search size={18} className="text-helm-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${category === 'all' ? 'everything' : category}...`}
            className="flex-1 bg-transparent text-helm-text placeholder:text-helm-text-muted outline-none"
          />
          <kbd className="text-xs text-helm-text-muted px-1.5 py-0.5 rounded border border-helm-border">esc</kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-helm-text-muted">
              {query ? 'No results found' : `No ${category === 'all' ? 'items' : category} yet`}
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-helm-primary text-white'
                    : 'text-helm-text hover:bg-helm-surface-elevated'
                }`}
              >
                {/* Icon */}
                {result.type === 'project' ? (
                  <FolderKanban size={16} className={index === selectedIndex ? 'text-white' : 'text-helm-text-muted'} />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleComplete(result)
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      index === selectedIndex
                        ? 'border-white/50 hover:border-white hover:bg-white/20'
                        : 'border-helm-border hover:border-helm-primary hover:bg-helm-primary/10'
                    }`}
                    title="Complete task"
                  />
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">
                    {result.title}
                  </p>
                  {result.subtitle && (
                    <p className={`text-xs truncate ${
                      index === selectedIndex ? 'text-white/70' : 'text-helm-text-muted'
                    }`}>
                      {result.subtitle}
                    </p>
                  )}
                </div>

                {/* Type badge */}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  index === selectedIndex
                    ? 'bg-white/20 text-white'
                    : 'bg-helm-bg text-helm-text-muted'
                }`}>
                  {result.type === 'project' ? 'Project' : result.type === 'inbox' ? 'Inbox' : 'Task'}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-helm-border flex items-center gap-4 text-xs text-helm-text-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-helm-border">Tab</kbd>
            category
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-helm-border">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-helm-border">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-helm-border">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-helm-border">↵↵</kbd>
            complete
          </span>
        </div>
      </div>
    </div>
  )
}

