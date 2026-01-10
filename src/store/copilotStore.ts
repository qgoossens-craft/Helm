import { create } from 'zustand'
import type { ConversationMessage } from '../types/global'

interface CopilotContext {
  projectId?: string
  taskId?: string
  quickTodoId?: string
}

interface CopilotState {
  messages: ConversationMessage[]
  currentContext: CopilotContext | null
  addMessage: (message: ConversationMessage) => void
  clearMessages: () => void
  setContext: (context: CopilotContext | null) => void
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  messages: [],
  currentContext: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),

  clearMessages: () => set({ messages: [] }),

  setContext: (context) => {
    const { currentContext, clearMessages } = get()
    // If context changes significantly, clear conversation
    const contextChanged =
      context?.projectId !== currentContext?.projectId ||
      context?.taskId !== currentContext?.taskId ||
      context?.quickTodoId !== currentContext?.quickTodoId
    if (contextChanged) {
      clearMessages()
    }
    set({ currentContext: context })
  }
}))
