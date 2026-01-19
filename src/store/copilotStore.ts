import { create } from 'zustand'
import type { ConversationMessage, Task, SubtaskSuggestion } from '../types/global'

interface CopilotContext {
  projectId?: string
  taskId?: string
  quickTodoId?: string
}

/** Extended message that includes subtask suggestions */
export interface CopilotMessage extends ConversationMessage {
  /** Optional subtask suggestions (only for assistant messages with type 'subtasks') */
  suggestions?: SubtaskSuggestion[]
  /** The task ID that was linked when this message was generated */
  linkedTaskId?: string
  /** The task title (for display in user messages) */
  linkedTaskTitle?: string
}

interface CopilotState {
  messages: CopilotMessage[]
  currentContext: CopilotContext | null
  linkedTask: Task | null
  addMessage: (message: CopilotMessage) => void
  clearMessages: () => void
  setContext: (context: CopilotContext | null) => void
  setLinkedTask: (task: Task | null) => void
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  messages: [],
  currentContext: null,
  linkedTask: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),

  clearMessages: () => set({ messages: [], linkedTask: null }),

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
  },

  setLinkedTask: (task) => set({ linkedTask: task })
}))
