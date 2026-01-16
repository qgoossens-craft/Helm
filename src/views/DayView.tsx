import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FolderKanban, ListTodo, Calendar, Sparkles, PartyPopper } from 'lucide-react'
import { useCalendarStore, type CalendarItem } from '../store/calendarStore'
import { useTasksStore } from '../store/tasksStore'
import { useQuickTodosStore } from '../store/quickTodosStore'
import { QuickTodoInput } from '../components/QuickTodoInput'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function DayView() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { fetchItems, itemsByDate } = useCalendarStore()
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
    return itemsByDate[date] || []
  }, [date, itemsByDate])

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

  // Calculate date context
  const dateContext = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(parsedDate)
    targetDate.setHours(0, 0, 0, 0)

    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    const dayName = DAY_NAMES[parsedDate.getDay()]
    const monthName = MONTH_NAMES[parsedDate.getMonth()]
    const day = parsedDate.getDate()
    const year = parsedDate.getFullYear()

    let relativeText: string
    let isToday = false
    const isPast = diffDays < 0
    const isFuture = diffDays > 0

    if (diffDays === 0) {
      relativeText = 'Today'
      isToday = true
    } else if (diffDays === 1) {
      relativeText = 'Tomorrow'
    } else if (diffDays === -1) {
      relativeText = 'Yesterday'
    } else if (diffDays > 1 && diffDays <= 7) {
      relativeText = `In ${diffDays} days`
    } else if (diffDays < -1 && diffDays >= -7) {
      relativeText = `${Math.abs(diffDays)} days ago`
    } else if (diffDays > 7) {
      relativeText = `In ${Math.ceil(diffDays / 7)} weeks`
    } else {
      relativeText = `${Math.ceil(Math.abs(diffDays) / 7)} weeks ago`
    }

    const fullDate = isToday
      ? `${monthName} ${day}, ${year}`
      : `${dayName}, ${monthName} ${day}, ${year}`

    return { relativeText, fullDate, isToday, isPast, isFuture, diffDays }
  }, [parsedDate])

  // Get contextual message based on state
  const contextMessage = useMemo(() => {
    const { isToday, isPast, isFuture } = dateContext
    const hasItems = items.length > 0
    const allComplete = hasItems && incompleteItems.length === 0

    if (allComplete) {
      return "All done! Great work."
    }
    if (!hasItems) {
      if (isPast) return "Nothing was scheduled for this day."
      if (isToday) return "A clear day ahead. Add something?"
      return "Nothing planned yet."
    }
    if (isToday) {
      return `${incompleteItems.length} item${incompleteItems.length !== 1 ? 's' : ''} to tackle today.`
    }
    if (isFuture) {
      return `${incompleteItems.length} item${incompleteItems.length !== 1 ? 's' : ''} coming up.`
    }
    return `${incompleteItems.length} item${incompleteItems.length !== 1 ? 's' : ''} were due.`
  }, [dateContext, items.length, incompleteItems.length])

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
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors group ${
          item.completed
            ? 'opacity-50'
            : 'hover:bg-helm-bg'
        }`}
      >
        <button
          onClick={() => handleToggleComplete(item)}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            item.completed
              ? 'bg-helm-success border-helm-success text-white'
              : 'border-helm-border/60 hover:border-helm-primary group-hover:border-helm-primary/50'
          }`}
        >
          {item.completed && <CheckCircle2 size={12} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-helm-text ${item.completed ? 'line-through text-helm-text-muted' : ''}`}>
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.type === 'task' ? (
              <span className="flex items-center gap-1 text-xs text-helm-text-muted">
                <FolderKanban size={11} />
                {item.projectName || 'Inbox'}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-helm-text-muted">
                <ListTodo size={11} />
                Quick Todo
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const allComplete = items.length > 0 && incompleteItems.length === 0

  return (
    <div className="h-full overflow-auto bg-helm-surface rounded-2xl">
      {/* Decorative header banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-helm-primary/10 via-helm-primary/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-helm-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative p-6 pb-8">
          {/* Back button - needs no-drag to escape the Layout's drag region */}
          <button
            onClick={() => navigate('/')}
            className="relative z-10 flex items-center gap-2 text-sm text-helm-text-muted hover:text-helm-text transition-colors mb-6"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>

          {/* Date header */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-helm-primary/10 text-helm-primary">
              <Calendar size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-semibold text-helm-text">
                  {dateContext.relativeText}
                </h1>
                {dateContext.isToday && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-helm-primary text-white rounded-full">
                    Now
                  </span>
                )}
              </div>
              <p className="text-sm text-helm-text-muted">{dateContext.fullDate}</p>
              <p className="text-sm text-helm-text mt-2 flex items-center gap-2">
                {allComplete && <Sparkles size={14} className="text-helm-success" />}
                {contextMessage}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        {/* Quick Add - at the top */}
        {date && (
          <div className="mb-6">
            <QuickTodoInput dueDate={date} />
          </div>
        )}

        {/* Items list */}
        {items.length === 0 ? (
          /* Empty state */
          <div className="py-8 text-helm-text-muted">
            <p className="text-sm">
              {dateContext.isFuture
                ? "Plan ahead by adding items above."
                : dateContext.isToday
                  ? "Add a quick todo above to get started."
                  : "This day had no scheduled items."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* All complete celebration */}
            {allComplete && (
              <div className="flex items-center gap-3 p-3 bg-helm-success/10 border border-helm-success/20 rounded-lg mb-3">
                <PartyPopper size={18} className="text-helm-success" />
                <span className="text-sm text-helm-text">
                  You've completed everything for this day!
                </span>
              </div>
            )}

            {/* Incomplete items */}
            {incompleteItems.map(renderItem)}

            {/* Completed items */}
            {completedItems.length > 0 && (
              <div className="pt-4">
                <p className="text-xs text-helm-text-muted uppercase tracking-wider mb-2 px-1">
                  Completed ({completedItems.length})
                </p>
                <div className="space-y-2">
                  {completedItems.map(renderItem)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
