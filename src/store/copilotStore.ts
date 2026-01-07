import { create } from 'zustand'
import type { ConversationMessage } from '../types/global'

interface CopilotState {
  messages: ConversationMessage[]
  currentProjectId: string | null
  addMessage: (message: ConversationMessage) => void
  clearMessages: () => void
  setProjectContext: (projectId: string | null) => void
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  messages: [],
  currentProjectId: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),

  clearMessages: () => set({ messages: [] }),

  setProjectContext: (projectId) => {
    const { currentProjectId, clearMessages } = get()
    // If project changes, clear conversation
    if (projectId !== currentProjectId) {
      clearMessages()
    }
    set({ currentProjectId: projectId })
  }
}))
