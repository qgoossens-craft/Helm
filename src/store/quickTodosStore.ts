import { create } from 'zustand'
import type { QuickTodo } from '../types/global'

interface QuickTodosState {
  todos: QuickTodo[]
  dueTodayTodos: QuickTodo[]
  overdueTodos: QuickTodo[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchAll: (list?: 'personal' | 'work') => Promise<void>
  fetchDueToday: () => Promise<void>
  fetchOverdue: () => Promise<void>
  createTodo: (todo: { title: string; list: 'personal' | 'work'; due_date?: string | null }) => Promise<QuickTodo>
  updateTodo: (id: string, updates: Partial<{ title: string; list: 'personal' | 'work'; due_date: string | null; completed: boolean }>) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  toggleComplete: (id: string) => Promise<void>
}

export const useQuickTodosStore = create<QuickTodosState>((set, get) => ({
  todos: [],
  dueTodayTodos: [],
  overdueTodos: [],
  isLoading: false,
  error: null,

  fetchAll: async (list) => {
    set({ isLoading: true, error: null })
    try {
      const todos = await window.api.quickTodos.getAll(list)
      set({ todos, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  fetchDueToday: async () => {
    try {
      const dueTodayTodos = await window.api.quickTodos.getDueToday()
      set({ dueTodayTodos })
    } catch (error) {
      console.error('Failed to fetch due today todos:', error)
    }
  },

  fetchOverdue: async () => {
    try {
      const overdueTodos = await window.api.quickTodos.getOverdue()
      set({ overdueTodos })
    } catch (error) {
      console.error('Failed to fetch overdue todos:', error)
    }
  },

  createTodo: async (todoData) => {
    set({ error: null })
    try {
      const todo = await window.api.quickTodos.create(todoData)
      set((state) => ({ todos: [todo, ...state.todos] }))

      // Log activity
      await window.api.activity.log({
        project_id: null,
        task_id: null,
        action_type: 'created',
        details: `Created quick todo: ${todo.title}`
      })

      return todo
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  updateTodo: async (id, updates) => {
    set({ error: null })
    try {
      const todo = await window.api.quickTodos.update(id, updates)
      set((state) => ({
        todos: state.todos.map((t) => (t.id === id ? todo : t)),
        dueTodayTodos: state.dueTodayTodos.map((t) => (t.id === id ? todo : t)),
        overdueTodos: state.overdueTodos.map((t) => (t.id === id ? todo : t))
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  deleteTodo: async (id) => {
    set({ error: null })
    try {
      await window.api.quickTodos.delete(id)
      set((state) => ({
        todos: state.todos.filter((t) => t.id !== id),
        dueTodayTodos: state.dueTodayTodos.filter((t) => t.id !== id),
        overdueTodos: state.overdueTodos.filter((t) => t.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  toggleComplete: async (id) => {
    const state = get()
    const todo = state.todos.find((t) => t.id === id)
    if (!todo) return

    await state.updateTodo(id, { completed: !todo.completed })
  }
}))
