import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FolderKanban, ListTodo } from 'lucide-react'
import { useCalendarStore, type CalendarItem } from '../store/calendarStore'
import { useTasksStore } from '../store/tasksStore'
import { useQuickTodosStore } from '../store/quickTodosStore'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function DayView() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { fetchItems, getItemsForDate } = useCalendarStore()
  const { updateTask } = useTasksStore()
  const { updateTodo } = useQuickTodosStore()

  // Parse the date
  const parsedDate = useMemo(() => {
    if (!date) return new Date()
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [date])

  // Fetch data
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const items = useMemo(() => {
    if (!date) return []
    return getItemsForDate(date)
  }, [date, getItemsForDate])

  // Separate completed and incomplete items
  const { incompleteItems, completedItems } = useMemo(() => {
    const incomplete: CalendarItem[] = []
    const completed: CalendarItem[] = []

    for (const item of items) {
      if (item.completed) {
        completed.push(item)
      } else {
        incomplete.push(item)
      }
    }

    return { incompleteItems: incomplete, completedItems: completed }
  }, [items])

  const formatDateHeader = () => {
    const dayName = DAY_NAMES[parsedDate.getDay()]
    const monthName = MONTH_NAMES[parsedDate.getMonth()]
    const day = parsedDate.getDate()
    const year = parsedDate.getFullYear()

    // Check if it's today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isToday = parsedDate.getTime() === today.getTime()

    if (isToday) {
      return `Today, ${monthName} ${day}`
    }

    return `${dayName}, ${monthName} ${day}, ${year}`
  }

  const handleToggleComplete = async (item: CalendarItem) => {
    if (item.type === 'task') {
      await updateTask(item.id, { status: item.completed ? 'todo' : 'done' })
    } else {
      await updateTodo(item.id, { completed: !item.completed })
    }
    // Refetch to update the view
    fetchItems()
  }

  const renderItem = (item: CalendarItem) => {
    return (
      <div
        key={item.id}
        className={`flex items-center gap-3 p-4 bg-helm-bg border rounded-lg group ${
          item.completed
            ? 'border-helm-border/50 opacity-60'
            : 'border-helm-border'
        }`}
      >
        <button
          onClick={() => handleToggleComplete(item)}
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            item.completed
              ? 'bg-helm-success border-helm-success text-white'
              : 'border-helm-border hover:border-helm-primary'
          }`}
        >
          {item.completed && <CheckCircle2 size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-helm-text truncate ${item.completed ? 'line-through text-helm-text-muted' : ''}`}>
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {item.type === 'task' ? (
              <span className="flex items-center gap-1 text-xs text-helm-text-muted">
                <FolderKanban size={12} />
                {item.projectName || 'Inbox'}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-helm-text-muted">
                <ListTodo size={12} />
                Quick Todo
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6 bg-helm-surface rounded-2xl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-helm-text-muted hover:text-helm-text transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-helm-text">{formatDateHeader()}</h1>
          <p className="text-sm text-helm-text-muted mt-1">
            {items.length === 0
              ? 'No items due this day'
              : `${incompleteItems.length} item${incompleteItems.length !== 1 ? 's' : ''} due${
                  completedItems.length > 0
                    ? `, ${completedItems.length} completed`
                    : ''
                }`}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-12 text-helm-text-muted">
              <p className="text-lg mb-2">No items due this day</p>
              <p className="text-sm">Items with this due date will appear here</p>
            </div>
          ) : (
            <>
              {/* Incomplete items */}
              {incompleteItems.map(renderItem)}

              {/* Completed items */}
              {completedItems.length > 0 && (
                <>
                  <div className="pt-4 pb-2">
                    <span className="text-xs text-helm-text-muted uppercase tracking-wider">
                      Completed
                    </span>
                  </div>
                  {completedItems.map(renderItem)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
