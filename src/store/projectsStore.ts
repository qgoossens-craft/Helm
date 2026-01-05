import { create } from 'zustand'
import type { Project } from '../types/global'

interface ProjectsState {
  projects: Project[]
  isLoading: boolean
  error: string | null

  // Actions
  fetchProjects: () => Promise<void>
  createProject: (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'archived_at'>) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  getProjectById: (id: string) => Project | undefined
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const projects = await window.api.projects.getAll()
      set({ projects, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createProject: async (projectData) => {
    set({ error: null })
    try {
      const project = await window.api.projects.create(projectData)
      set((state) => ({ projects: [...state.projects, project] }))

      // Log activity
      await window.api.activity.log({
        project_id: project.id,
        task_id: null,
        action_type: 'created',
        details: `Created project: ${project.name}`
      })

      return project
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  updateProject: async (id, updates) => {
    set({ error: null })
    try {
      const project = await window.api.projects.update(id, updates)
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? project : p))
      }))

      // Log activity
      await window.api.activity.log({
        project_id: id,
        task_id: null,
        action_type: 'updated',
        details: `Updated project`
      })
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  deleteProject: async (id) => {
    set({ error: null })
    try {
      await window.api.projects.delete(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id)
      }))
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  getProjectById: (id) => {
    return get().projects.find((p) => p.id === id)
  }
}))
