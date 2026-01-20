/**
 * Notification Service
 * Handles OS-level and in-app notifications for recurring tasks/todos
 */

import { Notification, BrowserWindow } from 'electron'
import { db } from '../database/db'
import {
  generateOccurrences,
  formatDateISO,
  type RecurringItem,
  type RecurrencePattern
} from './recurrence'

// Store scheduled notification timeouts
const scheduledNotifications = new Map<string, NodeJS.Timeout>()

// Store scheduled reminder timeouts
const scheduledReminders = new Map<string, NodeJS.Timeout>()

// Track reminders already sent today (to prevent duplicates)
const sentRemindersToday = new Set<string>()

// Main window reference for IPC
let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

/**
 * Send an OS-level notification
 */
export function sendOSNotification(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) {
    console.warn('OS notifications not supported on this platform')
    return
  }

  const notification = new Notification({
    title,
    body,
    silent: false
  })

  if (onClick) {
    notification.on('click', onClick)
  }

  notification.show()
}

/**
 * Send an in-app notification via IPC
 */
export function sendInAppNotification(notification: {
  id: string
  type: 'task' | 'todo'
  title: string
  message: string
  dueDate: string
  parentId: string
}): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notification:recurring', notification)
  }
}

/**
 * Get all recurring tasks and todos due today that need notifications
 */
export function getItemsDueToday(): Array<{
  type: 'task' | 'todo'
  item: RecurringItem & { list?: string }
}> {
  const today = formatDateISO(new Date())
  const items: Array<{ type: 'task' | 'todo'; item: RecurringItem & { list?: string } }> = []

  // Get recurring tasks
  const recurringTasks = db.tasks.getRecurring()
  for (const task of recurringTasks) {
    if (task.recurrence_pattern) {
      const recurringItem: RecurringItem = {
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        recurrence_pattern: task.recurrence_pattern as RecurrencePattern,
        recurrence_config: task.recurrence_config,
        recurrence_end_date: task.recurrence_end_date,
        recurring_parent_id: task.recurring_parent_id
      }

      // Check if this recurring task has an occurrence today
      const todayStart = new Date(today)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      const occurrences = generateOccurrences(recurringItem, todayStart, todayEnd)
      if (occurrences.length > 0) {
        // Check if an instance already exists and is completed
        const hasInstance = db.tasks.hasInstanceOnDate(task.id, today)
        if (!hasInstance) {
          items.push({ type: 'task', item: recurringItem })
        }
      }
    }
  }

  // Get recurring todos
  const recurringTodos = db.quickTodos.getRecurring()
  for (const todo of recurringTodos) {
    if (todo.recurrence_pattern) {
      const recurringItem: RecurringItem & { list?: string } = {
        id: todo.id,
        title: todo.title,
        due_date: todo.due_date,
        recurrence_pattern: todo.recurrence_pattern as RecurrencePattern,
        recurrence_config: todo.recurrence_config,
        recurrence_end_date: todo.recurrence_end_date,
        recurring_parent_id: todo.recurring_parent_id,
        list: todo.list
      }

      // Check if this recurring todo has an occurrence today
      const todayStart = new Date(today)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      const occurrences = generateOccurrences(recurringItem, todayStart, todayEnd)
      if (occurrences.length > 0) {
        // Check if an instance already exists
        const hasInstance = db.quickTodos.hasInstanceOnDate(todo.id, today)
        if (!hasInstance) {
          items.push({ type: 'todo', item: recurringItem })
        }
      }
    }
  }

  return items
}

/**
 * Send notifications for all items due today
 */
export function notifyDueItems(): void {
  const dueItems = getItemsDueToday()
  const today = formatDateISO(new Date())

  for (const { type, item } of dueItems) {
    const notificationId = `${type}-${item.id}-${today}`

    // Skip if we've already notified for this item today
    if (scheduledNotifications.has(notificationId)) {
      continue
    }

    // Send OS notification
    const typeLabel = type === 'task' ? 'Task' : 'Todo'
    sendOSNotification(
      `Recurring ${typeLabel} Due`,
      item.title,
      () => {
        // Focus the main window when clicked
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
      }
    )

    // Send in-app notification
    sendInAppNotification({
      id: notificationId,
      type,
      title: item.title,
      message: `This recurring ${type} is due today`,
      dueDate: today,
      parentId: item.id
    })

    // Mark as notified (will be cleared at end of day)
    scheduledNotifications.set(notificationId, setTimeout(() => {
      scheduledNotifications.delete(notificationId)
    }, 24 * 60 * 60 * 1000))
  }
}

/**
 * Get items with reminder_time set that are due today (recurring items with occurrences today)
 */
interface ReminderItem {
  type: 'task' | 'todo'
  id: string
  title: string
  reminderTime: string  // "HH:MM" format
  list?: string
}

function getItemsWithRemindersForToday(): ReminderItem[] {
  const today = formatDateISO(new Date())
  const items: ReminderItem[] = []

  // Get recurring tasks with reminder_time set
  const recurringTasks = db.tasks.getRecurring()
  for (const task of recurringTasks) {
    if (task.recurrence_pattern && task.reminder_time) {
      const recurringItem: RecurringItem = {
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        recurrence_pattern: task.recurrence_pattern as RecurrencePattern,
        recurrence_config: task.recurrence_config,
        recurrence_end_date: task.recurrence_end_date,
        recurring_parent_id: task.recurring_parent_id
      }

      // Check if this recurring task has an occurrence today
      const todayStart = new Date(today)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      const occurrences = generateOccurrences(recurringItem, todayStart, todayEnd)
      if (occurrences.length > 0) {
        items.push({
          type: 'task',
          id: task.id,
          title: task.title,
          reminderTime: task.reminder_time
        })
      }
    }
  }

  // Get recurring todos with reminder_time set
  const recurringTodos = db.quickTodos.getRecurring()
  for (const todo of recurringTodos) {
    if (todo.recurrence_pattern && todo.reminder_time) {
      const recurringItem: RecurringItem = {
        id: todo.id,
        title: todo.title,
        due_date: todo.due_date,
        recurrence_pattern: todo.recurrence_pattern as RecurrencePattern,
        recurrence_config: todo.recurrence_config,
        recurrence_end_date: todo.recurrence_end_date,
        recurring_parent_id: todo.recurring_parent_id
      }

      // Check if this recurring todo has an occurrence today
      const todayStart = new Date(today)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      const occurrences = generateOccurrences(recurringItem, todayStart, todayEnd)
      if (occurrences.length > 0) {
        items.push({
          type: 'todo',
          id: todo.id,
          title: todo.title,
          reminderTime: todo.reminder_time,
          list: todo.list
        })
      }
    }
  }

  return items
}

/**
 * Calculate milliseconds until a specific time today
 * Returns negative number if time has already passed
 */
function getDelayUntilTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const now = new Date()
  const targetTime = new Date()
  targetTime.setHours(hours, minutes, 0, 0)
  return targetTime.getTime() - now.getTime()
}

/**
 * Format 24-hour time to 12-hour format for display
 */
function formatTime12Hour(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Send a reminder notification for a specific item
 */
function sendReminderNotification(item: ReminderItem): void {
  const today = formatDateISO(new Date())
  const reminderKey = `${item.type}-${item.id}-${today}-${item.reminderTime}`

  // Skip if already sent today
  if (sentRemindersToday.has(reminderKey)) {
    return
  }

  // Mark as sent
  sentRemindersToday.add(reminderKey)

  // Send OS notification
  const typeLabel = item.type === 'task' ? 'Task' : 'Todo'
  const timeFormatted = formatTime12Hour(item.reminderTime)
  sendOSNotification(
    `Reminder: ${item.title}`,
    `${typeLabel} reminder set for ${timeFormatted}`,
    () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    }
  )

  // Send in-app notification
  sendInAppNotification({
    id: reminderKey,
    type: item.type,
    title: item.title,
    message: `Reminder scheduled for ${timeFormatted}`,
    dueDate: today,
    parentId: item.id
  })

  console.log(`Reminder sent for ${item.type} "${item.title}" at ${timeFormatted}`)
}

/**
 * Schedule reminders for all items due today
 * Called on startup and hourly to catch any new items
 */
export function scheduleRemindersForToday(): void {
  const items = getItemsWithRemindersForToday()
  const today = formatDateISO(new Date())

  for (const item of items) {
    const reminderKey = `${item.type}-${item.id}-${today}-${item.reminderTime}`

    // Skip if already scheduled or already sent
    if (scheduledReminders.has(reminderKey) || sentRemindersToday.has(reminderKey)) {
      continue
    }

    const delay = getDelayUntilTime(item.reminderTime)

    // If the time hasn't passed yet, schedule the reminder
    if (delay > 0) {
      const timeout = setTimeout(() => {
        sendReminderNotification(item)
        scheduledReminders.delete(reminderKey)
      }, delay)

      scheduledReminders.set(reminderKey, timeout)
      console.log(`Scheduled reminder for ${item.type} "${item.title}" at ${item.reminderTime} (in ${Math.round(delay / 60000)} minutes)`)
    }
  }
}

/**
 * Reset daily reminder state at midnight
 */
export function resetDailyReminderState(): void {
  // Clear all scheduled reminders
  for (const timeout of scheduledReminders.values()) {
    clearTimeout(timeout)
  }
  scheduledReminders.clear()

  // Clear the sent reminders tracking
  sentRemindersToday.clear()

  console.log('Daily reminder state reset')

  // Re-schedule for the new day
  scheduleRemindersForToday()
}

/**
 * Calculate milliseconds until next midnight
 */
function getDelayUntilMidnight(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.getTime() - now.getTime()
}

/**
 * Schedule daily notification check
 * Runs at startup and then every hour
 */
let notificationInterval: NodeJS.Timeout | null = null
let midnightResetTimeout: NodeJS.Timeout | null = null

export function startNotificationScheduler(): void {
  // Run immediately on startup
  notifyDueItems()

  // Schedule reminders for today
  scheduleRemindersForToday()

  // Schedule midnight reset
  const delayToMidnight = getDelayUntilMidnight()
  midnightResetTimeout = setTimeout(() => {
    resetDailyReminderState()
    // Schedule the next midnight reset
    midnightResetTimeout = setInterval(() => {
      resetDailyReminderState()
    }, 24 * 60 * 60 * 1000)
  }, delayToMidnight)

  // Then run every hour (for recurring notifications and new reminder items)
  notificationInterval = setInterval(() => {
    notifyDueItems()
    scheduleRemindersForToday()
  }, 60 * 60 * 1000)

  console.log('Notification scheduler started')
}

export function stopNotificationScheduler(): void {
  if (notificationInterval) {
    clearInterval(notificationInterval)
    notificationInterval = null
  }

  // Clear midnight reset timeout
  if (midnightResetTimeout) {
    clearTimeout(midnightResetTimeout)
    midnightResetTimeout = null
  }

  // Clear all scheduled notifications
  for (const timeout of scheduledNotifications.values()) {
    clearTimeout(timeout)
  }
  scheduledNotifications.clear()

  // Clear all scheduled reminders
  for (const timeout of scheduledReminders.values()) {
    clearTimeout(timeout)
  }
  scheduledReminders.clear()
  sentRemindersToday.clear()

  console.log('Notification scheduler stopped')
}

/**
 * Materialize a recurring item for today
 * Creates a concrete instance that can be completed
 */
export function materializeRecurringItem(
  type: 'task' | 'todo',
  parentId: string
): { success: boolean; instanceId?: string; error?: string } {
  const today = formatDateISO(new Date())

  try {
    if (type === 'task') {
      const parent = db.tasks.getById(parentId)
      if (!parent) {
        return { success: false, error: 'Parent task not found' }
      }

      // Check if instance already exists
      if (db.tasks.hasInstanceOnDate(parentId, today)) {
        // Return the existing instance
        const instances = db.tasks.getInstances(parentId)
        const todayInstance = instances.find(i => i.due_date === today)
        if (todayInstance) {
          return { success: true, instanceId: todayInstance.id }
        }
      }

      // Create new instance
      const instance = db.tasks.createInstance(parent, today)
      return { success: true, instanceId: instance.id }
    } else {
      const parent = db.quickTodos.getById(parentId)
      if (!parent) {
        return { success: false, error: 'Parent todo not found' }
      }

      // Check if instance already exists
      if (db.quickTodos.hasInstanceOnDate(parentId, today)) {
        const instances = db.quickTodos.getInstances(parentId)
        const todayInstance = instances.find(i => i.due_date === today)
        if (todayInstance) {
          return { success: true, instanceId: todayInstance.id }
        }
      }

      // Create new instance
      const instance = db.quickTodos.createInstance(parent, today)
      return { success: true, instanceId: instance.id }
    }
  } catch (error) {
    console.error('Error materializing recurring item:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get upcoming recurring items for the next N days
 * Used for calendar display and planning
 */
export function getUpcomingRecurringItems(days: number = 7): Array<{
  type: 'task' | 'todo'
  parentId: string
  title: string
  dates: string[]
  list?: string
}> {
  const items: Array<{
    type: 'task' | 'todo'
    parentId: string
    title: string
    dates: string[]
    list?: string
  }> = []

  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + days)

  // Get recurring tasks
  const recurringTasks = db.tasks.getRecurring()
  for (const task of recurringTasks) {
    if (task.recurrence_pattern) {
      const recurringItem: RecurringItem = {
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        recurrence_pattern: task.recurrence_pattern as RecurrencePattern,
        recurrence_config: task.recurrence_config,
        recurrence_end_date: task.recurrence_end_date,
        recurring_parent_id: task.recurring_parent_id
      }

      const occurrences = generateOccurrences(recurringItem, startDate, endDate)
      if (occurrences.length > 0) {
        items.push({
          type: 'task',
          parentId: task.id,
          title: task.title,
          dates: occurrences.map(d => formatDateISO(d))
        })
      }
    }
  }

  // Get recurring todos
  const recurringTodos = db.quickTodos.getRecurring()
  for (const todo of recurringTodos) {
    if (todo.recurrence_pattern) {
      const recurringItem: RecurringItem = {
        id: todo.id,
        title: todo.title,
        due_date: todo.due_date,
        recurrence_pattern: todo.recurrence_pattern as RecurrencePattern,
        recurrence_config: todo.recurrence_config,
        recurrence_end_date: todo.recurrence_end_date,
        recurring_parent_id: todo.recurring_parent_id
      }

      const occurrences = generateOccurrences(recurringItem, startDate, endDate)
      if (occurrences.length > 0) {
        items.push({
          type: 'todo',
          parentId: todo.id,
          title: todo.title,
          dates: occurrences.map(d => formatDateISO(d)),
          list: todo.list
        })
      }
    }
  }

  return items
}
