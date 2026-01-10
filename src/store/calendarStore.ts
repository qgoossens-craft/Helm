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
      // Fetch all tasks and todos, then filter client-side
      // This is simpler than adding new backend APIs
      const [allTodos, inboxTasks] = await Promise.all([
        window.api.quickTodos.getAll(),
        window.api.tasks.getInbox()
      ])

      // Get all projects to fetch their tasks
      const projects = await window.api.projects.getAll()
      const projectTasksPromises = projects.map(p =>
        window.api.tasks.getByProject(p.id).then(tasks =>
          tasks.map(t => ({ ...t, projectName: p.name }))
        )
      )
      const projectTasksArrays = await Promise.all(projectTasksPromises)
      const allProjectTasks = projectTasksArrays.flat()

      // Combine all tasks
      const allTasks = [...inboxTasks, ...allProjectTasks]

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
            projectName: (task as Task & { projectName?: string }).projectName
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
            completed: todo.completed
          })
        }
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
