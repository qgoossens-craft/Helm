import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface UIState {
  // Copilot modal
  isCopilotOpen: boolean
  copilotContext: {
    projectId?: string
    taskId?: string
  } | null

  // Project kickoff wizard
  isKickoffWizardOpen: boolean

  // Move to project modal
  isMoveToProjectOpen: boolean
  moveTaskId: string | null

  // Quick Switcher
  isQuickSwitcherOpen: boolean

  // Toasts
  toasts: Toast[]

  // Actions
  openCopilot: (context?: { projectId?: string; taskId?: string }) => void
  closeCopilot: () => void
  openKickoffWizard: () => void
  closeKickoffWizard: () => void
  openMoveToProject: (taskId: string) => void
  closeMoveToProject: () => void
  openQuickSwitcher: () => void
  closeQuickSwitcher: () => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  isCopilotOpen: false,
  copilotContext: null,
  isKickoffWizardOpen: false,
  isMoveToProjectOpen: false,
  moveTaskId: null,
  isQuickSwitcherOpen: false,
  toasts: [],

  openCopilot: (context) => {
    set({ isCopilotOpen: true, copilotContext: context || null })
  },

  closeCopilot: () => {
    set({ isCopilotOpen: false, copilotContext: null })
  },

  openKickoffWizard: () => {
    set({ isKickoffWizardOpen: true })
  },

  closeKickoffWizard: () => {
    set({ isKickoffWizardOpen: false })
  },

  openMoveToProject: (taskId) => {
    set({ isMoveToProjectOpen: true, moveTaskId: taskId })
  },

  closeMoveToProject: () => {
    set({ isMoveToProjectOpen: false, moveTaskId: null })
  },

  openQuickSwitcher: () => {
    set({ isQuickSwitcherOpen: true })
  },

  closeQuickSwitcher: () => {
    set({ isQuickSwitcherOpen: false })
  },

  addToast: (type, message) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }]
    }))
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  }
}))
