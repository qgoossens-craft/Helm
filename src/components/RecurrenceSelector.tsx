import { useState, useRef, useEffect } from 'react'
import { Repeat } from 'lucide-react'
import type { RecurrencePattern } from '../types/global'
import { ReminderTimeSelector } from './ReminderTimeSelector'

export interface RecurrenceConfig {
  weekDays?: number[]
  monthDay?: number
  yearMonth?: number
  yearDay?: number
}

interface RecurrenceSelectorProps {
  pattern: RecurrencePattern | null
  config: string | null
  endDate: string | null
  onRecurrenceChange: (
    pattern: RecurrencePattern | null,
    config: string | null,
    endDate: string | null
  ) => void
  reminderTime?: string | null
  onReminderTimeChange?: (time: string | null) => void
  className?: string
}

const RECURRENCE_PATTERNS: { value: RecurrencePattern; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily', description: 'Repeats every day' },
  { value: 'weekly', label: 'Weekly', description: 'Repeats every week' },
  { value: 'monthly', label: 'Monthly', description: 'Repeats every month' },
  { value: 'yearly', label: 'Yearly', description: 'Repeats every year' }
]

export function RecurrenceSelector({
  pattern,
  config,
  endDate,
  onRecurrenceChange,
  reminderTime,
  onReminderTimeChange,
  className = ''
}: RecurrenceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showEndDate, setShowEndDate] = useState(!!endDate)
  const [localEndDate, setLocalEndDate] = useState(endDate || '')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectPattern = (newPattern: RecurrencePattern | null) => {
    onRecurrenceChange(newPattern, config, showEndDate ? localEndDate : null)
    if (!newPattern) {
      setIsOpen(false)
    }
  }

  const handleEndDateChange = (date: string) => {
    setLocalEndDate(date)
    if (pattern) {
      onRecurrenceChange(pattern, config, date || null)
    }
  }

  const handleClearEndDate = () => {
    setShowEndDate(false)
    setLocalEndDate('')
    if (pattern) {
      onRecurrenceChange(pattern, config, null)
    }
  }

  const getPatternLabel = (p: RecurrencePattern): string => {
    const found = RECURRENCE_PATTERNS.find(rp => rp.value === p)
    return found?.label || p
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="p-1 rounded hover:bg-helm-surface-elevated transition-colors"
        title={pattern ? `Repeats ${pattern}` : 'Set recurrence'}
      >
        <Repeat
          size={14}
          className="text-helm-primary"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-helm-surface-elevated border border-helm-border rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
          {/* No recurrence option */}
          <button
            onClick={() => handleSelectPattern(null)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-helm-bg transition-colors flex items-center gap-2 ${
              pattern === null ? 'text-helm-primary' : 'text-helm-text-muted'
            }`}
          >
            <span className="w-2 h-2 rounded-full border border-helm-border" />
            No repeat
          </button>

          <div className="border-t border-helm-border my-1" />

          {/* Recurrence pattern options */}
          {RECURRENCE_PATTERNS.map((rp) => (
            <button
              key={rp.value}
              onClick={() => handleSelectPattern(rp.value)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-helm-bg transition-colors ${
                pattern === rp.value ? 'text-helm-primary' : 'text-helm-text'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    pattern === rp.value ? 'bg-helm-primary' : 'border border-helm-border'
                  }`}
                />
                <span className="font-medium">{rp.label}</span>
              </div>
              <p className="text-xs text-helm-text-muted ml-4 mt-0.5">{rp.description}</p>
            </button>
          ))}

          {/* End date section - only show when a pattern is selected */}
          {pattern && (
            <>
              <div className="border-t border-helm-border my-1" />
              <div className="px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-helm-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEndDate}
                    onChange={(e) => {
                      setShowEndDate(e.target.checked)
                      if (!e.target.checked) {
                        handleClearEndDate()
                      }
                    }}
                    className="rounded border-helm-border text-helm-primary focus:ring-helm-primary"
                  />
                  Set end date
                </label>
                {showEndDate && (
                  <input
                    type="date"
                    value={localEndDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="mt-2 w-full bg-helm-bg border border-helm-border rounded px-2 py-1 text-sm text-helm-text"
                    min={new Date().toISOString().split('T')[0]}
                  />
                )}
              </div>
            </>
          )}

          {/* Reminder time section - only show when a pattern is selected and handler is provided */}
          {pattern && onReminderTimeChange && (
            <>
              <div className="border-t border-helm-border my-1" />
              <div className="px-3 py-2">
                <label className="text-sm text-helm-text-muted block mb-2">
                  Daily reminder
                </label>
                <ReminderTimeSelector
                  value={reminderTime ?? null}
                  onChange={onReminderTimeChange}
                />
              </div>
            </>
          )}

          {/* Current recurrence summary */}
          {pattern && (
            <div className="border-t border-helm-border mt-1 px-3 py-2">
              <p className="text-xs text-helm-text-muted">
                Currently: {getPatternLabel(pattern)}
                {endDate && ` until ${new Date(endDate).toLocaleDateString()}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Simple indicator showing that an item is recurring
 */
interface RecurrenceIndicatorProps {
  pattern: RecurrencePattern | null
  isInstance?: boolean
  className?: string
}

export function RecurrenceIndicator({ pattern, isInstance, className = '' }: RecurrenceIndicatorProps) {
  if (!pattern) return null

  const getLabel = (): string => {
    if (isInstance) return 'Instance'
    switch (pattern) {
      case 'daily': return 'Daily'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      case 'yearly': return 'Yearly'
      default: return 'Recurring'
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-helm-primary/10 text-helm-primary ${className}`}
      title={isInstance ? 'Instance of a recurring item' : `Repeats ${pattern}`}
    >
      <Repeat size={10} />
      {getLabel()}
    </span>
  )
}
