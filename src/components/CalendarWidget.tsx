import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarStore } from '../store/calendarStore'

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface CalendarDay {
  date: Date
  dateString: string
  isCurrentMonth: boolean
  isToday: boolean
  itemCount: number
}

// Format date to YYYY-MM-DD in local timezone (avoids UTC shift)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function CalendarWidget() {
  const navigate = useNavigate()
  const { fetchItems, getItemCountForDate, itemsByDate } = useCalendarStore()

  const [viewDate, setViewDate] = useState(() => new Date())

  // Fetch items on mount
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Generate calendar days
  const calendarDays = useMemo((): CalendarDay[] => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)

    // Convert JS day (Sun=0) to Monday-first (Mon=0, Sun=6)
    const getMondayFirstDay = (date: Date) => (date.getDay() + 6) % 7

    // Start from the Monday before (or on) the first day
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - getMondayFirstDay(firstDay))

    // End on the Sunday after (or on) the last day
    const endDate = new Date(lastDay)
    const daysToAdd = 6 - getMondayFirstDay(lastDay)
    endDate.setDate(endDate.getDate() + daysToAdd)

    const days: CalendarDay[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const current = new Date(startDate)
    while (current <= endDate) {
      // Use local date formatting to avoid timezone issues
      const dateString = formatLocalDate(current)
      const dateWithoutTime = new Date(current)
      dateWithoutTime.setHours(0, 0, 0, 0)

      days.push({
        date: new Date(current),
        dateString,
        isCurrentMonth: current.getMonth() === month,
        isToday: dateWithoutTime.getTime() === today.getTime(),
        itemCount: getItemCountForDate(dateString)
      })

      current.setDate(current.getDate() + 1)
    }

    return days
    // eslint-disable-next-line react-hooks/exhaustive-deps -- itemsByDate triggers re-render when store updates
  }, [viewDate, getItemCountForDate, itemsByDate])

  const goToPreviousMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setViewDate(new Date())
  }

  const handleDayClick = (day: CalendarDay) => {
    navigate(`/day/${day.dateString}`)
  }

  // Render dots based on item count (max 3 dots shown)
  const renderDots = (count: number) => {
    if (count === 0) return null
    const dotCount = Math.min(count, 3)
    return (
      <div className="flex gap-0.5 justify-center mt-0.5">
        {Array.from({ length: dotCount }).map((_, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full bg-helm-primary"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="px-2 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={goToPreviousMonth}
          className="p-1 rounded hover:bg-helm-surface-elevated text-helm-text-muted hover:text-helm-text transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={goToToday}
          className="text-xs font-medium text-helm-text hover:text-helm-primary transition-colors"
        >
          {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
        </button>
        <button
          onClick={goToNextMonth}
          className="p-1 rounded hover:bg-helm-surface-elevated text-helm-text-muted hover:text-helm-text transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map(day => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-helm-text-muted py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => handleDayClick(day)}
            className={`
              relative flex flex-col items-center py-1 rounded text-xs transition-colors
              ${day.isToday
                ? 'bg-helm-primary text-white font-medium'
                : day.isCurrentMonth
                  ? 'text-helm-text hover:bg-helm-surface-elevated'
                  : 'text-helm-text-muted/50 hover:bg-helm-surface-elevated'
              }
            `}
          >
            <span>{day.date.getDate()}</span>
            {!day.isToday && renderDots(day.itemCount)}
            {day.isToday && day.itemCount > 0 && (
              <div className="flex gap-0.5 justify-center mt-0.5">
                {Array.from({ length: Math.min(day.itemCount, 3) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-1 rounded-full bg-white/80"
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
