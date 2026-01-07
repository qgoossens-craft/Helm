import { create } from 'zustand'

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

  // Obsidian Browser
  isObsidianBrowserOpen: boolean
  obsidianBrowserContext: {
    projectId: string | null
    taskId: string | null
  } | null

  // Actions
  openCopilot: (context?: { projectId?: string; taskId?: string }) => void
  closeCopilot: () => void
  openKickoffWizard: () => void
  closeKickoffWizard: () => void
  openMoveToProject: (taskId: string) => void
  closeMoveToProject: () => void
  openQuickSwitcher: () => void
  closeQuickSwitcher: () => void
  openObsidianBrowser: (context: { projectId: string | null; taskId: string | null }) => void
  closeObsidianBrowser: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isCopilotOpen: false,
  copilotContext: null,
  isKickoffWizardOpen: false,
  isMoveToProjectOpen: false,
  moveTaskId: null,
  isQuickSwitcherOpen: false,
  isObsidianBrowserOpen: false,
  obsidianBrowserContext: null,

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

  openObsidianBrowser: (context) => {
    set({ isObsidianBrowserOpen: true, obsidianBrowserContext: context })
  },

  closeObsidianBrowser: () => {
    set({ isObsidianBrowserOpen: false, obsidianBrowserContext: null })
  }
}))
