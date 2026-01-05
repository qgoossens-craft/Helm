// Type declarations for the Electron API exposed via preload

export interface Project {
  id: string
  name: string
  why: string
  done_definition: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'abandoned'
  context: 'work' | 'personal'
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface Task {
  id: string
  project_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  order: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface ActivityLogEntry {
  id: string
  project_id: string | null
  task_id: string | null
  action_type: 'created' | 'updated' | 'completed' | 'viewed' | 'commented'
  details: string | null
  created_at: string
}

export interface AIConversation {
  id: string
  project_id: string | null
  task_id: string | null
  user_message: string
  ai_response: string
  feedback: 'helpful' | 'not_helpful' | null
  created_at: string
}

export interface ParsedProject {
  name: string
  why: string
  doneDefinition: string
  context: 'work' | 'personal'
  tasks: string[]
}

export interface Document {
  id: string
  project_id: string | null
  task_id: string | null
  name: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
}

export interface ChatResponse {
  response: string
  conversationId: string
}

declare global {
  interface Window {
    api: {
      projects: {
        getAll: () => Promise<Project[]>
        getById: (id: string) => Promise<Project | null>
        create: (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'archived_at'>) => Promise<Project>
        update: (id: string, updates: Partial<Project>) => Promise<Project>
        delete: (id: string) => Promise<void>
      }
      tasks: {
        getByProject: (projectId: string | null) => Promise<Task[]>
        getInbox: () => Promise<Task[]>
        getById: (id: string) => Promise<Task | null>
        create: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) => Promise<Task>
        update: (id: string, updates: Partial<Task>) => Promise<Task>
        delete: (id: string) => Promise<void>
        reorder: (taskId: string, newOrder: number) => Promise<void>
      }
      activity: {
        log: (entry: Omit<ActivityLogEntry, 'id' | 'created_at'>) => Promise<ActivityLogEntry>
        getRecent: (projectId?: string, limit?: number) => Promise<ActivityLogEntry[]>
      }
      settings: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
        getAll: () => Promise<Record<string, string>>
      }
      ai: {
        save: (conversation: Omit<AIConversation, 'id' | 'created_at'>) => Promise<AIConversation>
        getByProject: (projectId: string) => Promise<AIConversation[]>
      }
      documents: {
        create: (doc: Omit<Document, 'id' | 'created_at'>) => Promise<Document>
        getByTask: (taskId: string) => Promise<Document[]>
        getByProject: (projectId: string) => Promise<Document[]>
        delete: (id: string) => Promise<void>
      }
      copilot: {
        chat: (message: string, projectId?: string, taskId?: string) => Promise<ChatResponse>
        parseProjectBrainDump: (brainDump: string) => Promise<ParsedProject>
        suggestTaskBreakdown: (taskTitle: string, projectContext?: string) => Promise<string[]>
      }
      onShortcut: (channel: string, callback: () => void) => () => void
    }
  }
}

export {}
