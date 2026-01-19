import { create } from 'zustand'
import type { Task } from '../types/global'

export interface CalendarItem {
  id: string
  title: string
  type: 'task' | 'todo'
  dueDate: string
  completed: boolean
  projectId?: string | null
  projectName?: string
  isRecurring?: boolean
  isVirtualOccurrence?: boolean
  recurringParentId?: string
}

interface CalendarState {
  itemsByDate: Record<string, CalendarItem[]>
  isLoading: boolean
  error: string | null

  // Actions
  fetchItems: () => Promise<void>
  getItemsForDate: (date: string) => CalendarItem[]
  getItemCountForDate: (date: string) => number
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  itemsByDate: {},
  isLoading: false,
  error: null,

  fetchItems: async () => {
    set({ isLoading: true, error: null })
    try {
      // Fetch all tasks with due dates and todos in parallel (single query each - no N+1)
      // Also fetch projects to map project names to tasks
      const [allTodos, tasksWithDueDate, projects] = await Promise.all([
        window.api.quickTodos.getAll(),
        window.api.tasks.getAllWithDueDate(),
        window.api.projects.getAll()
      ])

      // Create a project lookup map for efficient name resolution
      const projectMap = new Map(projects.map(p => [p.id, p.name]))

      // Add project names to tasks
      const allTasks = tasksWithDueDate.map(t => ({
        ...t,
        projectName: t.project_id ? projectMap.get(t.project_id) : undefined
      }))

      // Build the items by date map
      const itemsByDate: Record<string, CalendarItem[]> = {}

      // Add tasks with due dates
      for (const task of allTasks) {
        if (task.due_date) {
          const dateKey = task.due_date.split('T')[0] // Normalize to YYYY-MM-DD
          if (!itemsByDate[dateKey]) {
            itemsByDate[dateKey] = []
          }
          itemsByDate[dateKey].push({
            id: task.id,
            title: task.title,
            type: 'task',
            dueDate: task.due_date,
            completed: task.status === 'done',
            projectId: task.project_id,
            projectName: (task as Task & { projectName?: string }).projectName,
            isRecurring: !!task.recurrence_pattern,
            recurringParentId: task.recurring_parent_id || undefined
          })
        }
      }

      // Add todos with due dates
      for (const todo of allTodos) {
        if (todo.due_date) {
          const dateKey = todo.due_date.split('T')[0]
          if (!itemsByDate[dateKey]) {
            itemsByDate[dateKey] = []
          }
          itemsByDate[dateKey].push({
            id: todo.id,
            title: todo.title,
            type: 'todo',
            dueDate: todo.due_date,
            completed: todo.completed,
            isRecurring: !!todo.recurrence_pattern,
            recurringParentId: todo.recurring_parent_id || undefined
          })
        }
      }

      // Add virtual recurring occurrences (30 days lookahead)
      try {
        const upcomingRecurring = await window.api.notifications.getUpcoming(30)

        // Get date range for completions query (today to 30 days ahead)
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 30)
        const startDateStr = today.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        // Fetch recurring completions for the date range
        const completions = await window.api.recurringCompletions.getCompletionsInRange(startDateStr, endDateStr)
        const completionSet = new Set(completions.map(c => `${c.parent_id}-${c.completion_date}`))

        for (const recurring of upcomingRecurring) {
          for (const date of recurring.dates) {
            const dateKey = date.split('T')[0]

            // Check if we already have an instance for this date (either materialized or regular)
            const existingItems = itemsByDate[dateKey] || []
            const alreadyExists = existingItems.some(item =>
              item.recurringParentId === recurring.parentId ||
              item.id === recurring.parentId
            )

            if (!alreadyExists) {
              if (!itemsByDate[dateKey]) {
                itemsByDate[dateKey] = []
              }

              // Check if this occurrence has been completed
              const isCompleted = completionSet.has(`${recurring.parentId}-${dateKey}`)

              itemsByDate[dateKey].push({
                id: `virtual-${recurring.parentId}-${date}`,
                title: recurring.title,
                type: recurring.type,
                dueDate: date,
                completed: isCompleted,
                isRecurring: true,
                isVirtualOccurrence: true,
                recurringParentId: recurring.parentId
              })
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch recurring items for calendar:', err)
      }

      set({ itemsByDate, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  getItemsForDate: (date: string) => {
    const state = get()
    return state.itemsByDate[date] || []
  },

  getItemCountForDate: (date: string) => {
    const state = get()
    const items = state.itemsByDate[date] || []
    // Only count incomplete items
    return items.filter(item => !item.completed).length
  }
}))
