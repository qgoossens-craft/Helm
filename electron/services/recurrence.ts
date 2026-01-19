/**
 * Recurrence Service
 * Handles calculation of recurring task/todo occurrences
 */

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceConfig {
  weekDays?: number[]  // 0=Sunday, 1=Monday, etc.
  monthDay?: number    // 1-31
  yearMonth?: number   // 1-12
  yearDay?: number     // 1-31
}

export interface RecurringItem {
  id: string
  title: string
  due_date: string | null
  recurrence_pattern: RecurrencePattern
  recurrence_config: string | null
  recurrence_end_date: string | null
  recurring_parent_id: string | null
}

/**
 * Parse recurrence config from JSON string
 */
export function parseRecurrenceConfig(configStr: string | null): RecurrenceConfig | null {
  if (!configStr) return null
  try {
    return JSON.parse(configStr) as RecurrenceConfig
  } catch {
    return null
  }
}

/**
 * Calculate the next occurrence date after a given date
 */
export function getNextOccurrence(
  pattern: RecurrencePattern,
  fromDate: Date,
  config?: RecurrenceConfig | null
): Date {
  const next = new Date(fromDate)

  switch (pattern) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break

    case 'weekly':
      next.setDate(next.getDate() + 7)
      break

    case 'monthly': {
      // If config has specific day, use it
      const monthDay = config?.monthDay || next.getDate()
      next.setMonth(next.getMonth() + 1)
      // Handle months with fewer days
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
      next.setDate(Math.min(monthDay, daysInMonth))
      break
    }

    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      if (config?.yearMonth) {
        next.setMonth(config.yearMonth - 1)
      }
      if (config?.yearDay) {
        next.setDate(config.yearDay)
      }
      break
  }

  return next
}

/**
 * Generate all occurrences between two dates for a recurring item
 * Used for calendar display
 */
export function generateOccurrences(
  item: RecurringItem,
  startDate: Date,
  endDate: Date
): Date[] {
  const occurrences: Date[] = []
  const config = parseRecurrenceConfig(item.recurrence_config)

  // Start from the item's due_date or the start of the range
  let current: Date
  if (item.due_date) {
    current = new Date(item.due_date)
    // If due_date is before our range, advance to first occurrence in range
    while (current < startDate) {
      current = getNextOccurrence(item.recurrence_pattern, current, config)
    }
  } else {
    current = new Date(startDate)
  }

  // End date constraint
  const effectiveEnd = item.recurrence_end_date
    ? new Date(Math.min(new Date(item.recurrence_end_date).getTime(), endDate.getTime()))
    : endDate

  // Generate occurrences up to the end date (max 100 to prevent infinite loops)
  let count = 0
  while (current <= effectiveEnd && count < 100) {
    occurrences.push(new Date(current))
    current = getNextOccurrence(item.recurrence_pattern, current, config)
    count++
  }

  return occurrences
}

/**
 * Check if an item should have an occurrence on a specific date
 */
export function hasOccurrenceOnDate(
  item: RecurringItem,
  targetDate: Date
): boolean {
  const config = parseRecurrenceConfig(item.recurrence_config)

  // Normalize target date to start of day
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)

  // Start from item's due_date
  if (!item.due_date) return false

  const current = new Date(item.due_date)
  current.setHours(0, 0, 0, 0)

  // Check if we've passed the end date
  if (item.recurrence_end_date) {
    const endDate = new Date(item.recurrence_end_date)
    endDate.setHours(23, 59, 59, 999)
    if (target > endDate) return false
  }

  // If target is before due_date, no occurrence
  if (target < current) return false

  // For daily, check if it's on or after start
  if (item.recurrence_pattern === 'daily') {
    return true
  }

  // For weekly, check day of week matches
  if (item.recurrence_pattern === 'weekly') {
    const startDayOfWeek = current.getDay()
    return target.getDay() === startDayOfWeek
  }

  // For monthly, check day of month matches
  if (item.recurrence_pattern === 'monthly') {
    const expectedDay = config?.monthDay || current.getDate()
    return target.getDate() === expectedDay
  }

  // For yearly, check month and day match
  if (item.recurrence_pattern === 'yearly') {
    const expectedMonth = config?.yearMonth ? config.yearMonth - 1 : current.getMonth()
    const expectedDay = config?.yearDay || current.getDate()
    return target.getMonth() === expectedMonth && target.getDate() === expectedDay
  }

  return false
}

/**
 * Get a human-readable description of the recurrence pattern
 */
export function getRecurrenceDescription(
  pattern: RecurrencePattern,
  config?: RecurrenceConfig | null
): string {
  switch (pattern) {
    case 'daily':
      return 'Every day'
    case 'weekly':
      return 'Every week'
    case 'monthly':
      if (config?.monthDay) {
        return `Every month on day ${config.monthDay}`
      }
      return 'Every month'
    case 'yearly':
      return 'Every year'
    default:
      return 'Recurring'
  }
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}
