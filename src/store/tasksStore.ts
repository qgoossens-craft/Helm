import { create } from 'zustand'
import type { Task } from '../types/global'

interface TasksState {
  tasks: Task[]
  inboxTasks: Task[]
  deletedTasks: Task[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchTasksByProject: (projectId: string | null) => Promise<void>
  fetchInbox: () => Promise<void>
  fetchDeletedTasks: (projectId: string) => Promise<void>
  createTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'deleted_at'>) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  restoreTask: (id: string) => Promise<void>
  reorderTask: (taskId: string, newOrder: number) => Promise<void>
  moveToProject: (taskId: string, projectId: string) => Promise<void>
  getTaskById: (id: string) => Task | undefined
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  inboxTasks: [],
  deletedTasks: [],
  isLoading: false,
  error: null,

  fetchTasksByProject: async (projectId) => {
    set({ isLoading: true, error: null, deletedTasks: [] })
    try {
      const fetchedTasks = await window.api.tasks.getByProject(projectId)
      set((state) => {
        // Remove old tasks for this project and add the new ones
        const otherTasks = state.tasks.filter((t) => t.project_id !== projectId)
        return { tasks: [...otherTasks, ...fetchedTasks], isLoading: false }
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  fetchInbox: async () => {
    set({ isLoading: true, error: null })
    try {
      const inboxTasks = await window.api.tasks.getInbox()
      set({ inboxTasks, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  fetchDeletedTasks: async (projectId) => {
    try {
      const deletedTasks = await window.api.tasks.getDeleted(projectId)
      set({ deletedTasks })
    } catch (error) {
      console.error('Failed to fetch deleted tasks:', error)
    }
  },

  createTask: async (taskData) => {
    set({ error: null })
    try {
      const task = await window.api.tasks.create(taskData)

      if (task.project_id === null) {
        set((state) => ({ inboxTasks: [...state.inboxTasks, task] }))
      } else {
        set((state) => ({ tasks: [...state.tasks, task] }))
      }

      // Log activity
      await window.api.activity.log({
        project_id: task.project_id,
        task_id: task.id,
        action_type: 'created',
        details: `Created task: ${task.title}`
      })

      return task
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  updateTask: async (id, updates) => {
    set({ error: null })
    try {
      const task = await window.api.tasks.update(id, updates)

      // Update in both lists
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        inboxTasks: state.inboxTasks.map((t) => (t.id === id ? task : t))
      }))

      // Log activity
      const actionType = updates.status === 'done' ? 'completed' : 'updated'
      await window.api.activity.log({
        project_id: task.project_id,
        task_id: id,
        action_type: actionType,
        details: actionType === 'completed' ? `Completed task: ${task.title}` : `Updated task: ${task.title}`
      })
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  deleteTask: async (id) => {
    set({ error: null })
    try {
      // Get the task before deleting so we can add it to deletedTasks
      const state = get()
      const taskToDelete = state.tasks.find((t) => t.id === id)

      await window.api.tasks.delete(id)

      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        inboxTasks: state.inboxTasks.filter((t) => t.id !== id),
        // Add to deletedTasks if it was a project task (keeps max 10, newest first)
        deletedTasks: taskToDelete?.project_id
          ? [{ ...taskToDelete, deleted_at: new Date().toISOString() }, ...state.deletedTasks].slice(0, 10)
          : state.deletedTasks
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  restoreTask: async (id) => {
    set({ error: null })
    try {
      const task = await window.api.tasks.restore(id)
      set((state) => ({
        tasks: [...state.tasks, task],
        deletedTasks: state.deletedTasks.filter((t) => t.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  reorderTask: async (taskId, newOrder) => {
    set({ error: null })
    try {
      await window.api.tasks.reorder(taskId, newOrder)
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  moveToProject: async (taskId, projectId) => {
    set({ error: null })
    try {
      const task = await window.api.tasks.update(taskId, { project_id: projectId })

      // Remove from inbox and add to tasks
      set((state) => ({
        inboxTasks: state.inboxTasks.filter((t) => t.id !== taskId),
        tasks: [...state.tasks, task]
      }))

      // Log activity
      await window.api.activity.log({
        project_id: projectId,
        task_id: taskId,
        action_type: 'updated',
        details: `Moved task to project`
      })
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  getTaskById: (id) => {
    const state = get()
    return state.tasks.find((t) => t.id === id) || state.inboxTasks.find((t) => t.id === id)
  }
}))
