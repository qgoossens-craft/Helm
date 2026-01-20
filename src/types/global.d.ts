// Type declarations for the Electron API exposed via preload

export interface Project {
  id: string
  name: string
  why: string
  done_definition: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'abandoned'
  context: 'work' | 'personal'
  color: string | null
  icon: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceConfig {
  // For weekly: which days (0=Sunday, 1=Monday, etc.)
  weekDays?: number[]
  // For monthly: day of month (1-31)
  monthDay?: number
  // For yearly: month and day
  yearMonth?: number
  yearDay?: number
}

export interface Task {
  id: string
  project_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | null
  due_date: string | null
  category: string | null
  order: number
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
  // Recurrence fields
  recurrence_pattern: RecurrencePattern | null
  recurrence_config: string | null  // JSON stringified RecurrenceConfig
  recurring_parent_id: string | null
  recurrence_end_date: string | null
  reminder_time: string | null  // Format: "HH:MM" in 24-hour format
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
  quick_todo_id: string | null
  name: string
  file_path: string
  file_type: string
  file_size: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_error: string | null
  extracted_text: string | null
  created_at: string
}

export interface UploadResult {
  success: boolean
  documentId: string
  error?: string
}

export interface DocumentSearchResult {
  documentName: string
  content: string
  relevance: number
}

export interface ChatResponse {
  response: string
  conversationId: string
}

export interface SubtaskSuggestion {
  title: string
  description?: string
}

export interface CopilotResponse {
  type: 'message' | 'subtasks'
  content: string  // For 'message' type, this is the response text
  suggestions?: SubtaskSuggestion[]  // For 'subtasks' type
  conversationId: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface VaultFile {
  path: string
  name: string
  relativePath: string
}

export interface ObsidianImportResult {
  imported: number
  failed: number
  errors: Array<{ file: string; error: string }>
}

export interface QuickTodo {
  id: string
  title: string
  description: string | null
  list: 'personal' | 'work' | 'tweaks'
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  // Recurrence fields
  recurrence_pattern: RecurrencePattern | null
  recurrence_config: string | null  // JSON stringified RecurrenceConfig
  recurring_parent_id: string | null
  recurrence_end_date: string | null
  reminder_time: string | null  // Format: "HH:MM" in 24-hour format
  // Subtask field
  parent_quick_todo_id: string | null
}

export interface Source {
  id: string
  project_id: string | null
  task_id: string | null
  quick_todo_id: string | null
  url: string
  title: string
  description: string | null
  favicon_url: string | null
  source_type: 'link' | 'article' | 'video' | 'document'
  created_at: string
}

export interface UrlMetadata {
  title: string
  description: string | null
  favicon_url: string | null
  source_type: 'link' | 'article' | 'video' | 'document'
}

export interface CompletionStats {
  tasks: {
    today: number
    week: number
    month: number
    allTime: number
  }
  todos: {
    today: number
    week: number
    month: number
    allTime: number
    byList: {
      personal: number
      work: number
      tweaks: number
    }
  }
  projects: {
    completed: number
  }
  streak: {
    current: number
    longest: number
  }
  bestDay: {
    date: string
    count: number
  }
  weeklyTrend: Array<{
    day: string
    tasks: number
    todos: number
  }>
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
        getDeleted: (projectId: string) => Promise<Task[]>
        getById: (id: string) => Promise<Task | null>
        create: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'deleted_at'>) => Promise<Task>
        update: (id: string, updates: Partial<Task>) => Promise<Task>
        delete: (id: string) => Promise<void>
        restore: (id: string) => Promise<Task>
        reorder: (taskId: string, newOrder: number) => Promise<void>
        getCategoriesByProject: (projectId: string) => Promise<string[]>
        createSubtasks: (parentTaskId: string, subtasks: Array<{ title: string; description?: string }>) => Promise<string[]>
        // Batch methods to prevent N+1 queries
        getSubtasksByParentIds: (parentIds: string[]) => Promise<Record<string, Task[]>>
        getAllWithDueDate: () => Promise<Task[]>
        // Recurrence methods
        getRecurring: (projectId?: string) => Promise<Task[]>
        getInstances: (parentId: string) => Promise<Task[]>
        createInstance: (parentTask: Task, dueDate: string) => Promise<Task>
        hasInstanceOnDate: (parentId: string, dueDate: string) => Promise<boolean>
        getDueOnDate: (date: string) => Promise<Task[]>
      }
      activity: {
        log: (entry: Omit<ActivityLogEntry, 'id' | 'created_at'>) => Promise<ActivityLogEntry>
        getRecent: (projectId?: string, limit?: number) => Promise<ActivityLogEntry[]>
      }
      settings: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
        getAll: () => Promise<Record<string, string>>
        setSecure: (key: string, value: string) => Promise<void>
        getSecure: (key: string) => Promise<string | null>
        isEncryptionAvailable: () => Promise<boolean>
      }
      ai: {
        save: (conversation: Omit<AIConversation, 'id' | 'created_at'>) => Promise<AIConversation>
        getByProject: (projectId: string) => Promise<AIConversation[]>
      }
      documents: {
        getById: (id: string) => Promise<Document | null>
        getByTask: (taskId: string) => Promise<Document[]>
        getByProject: (projectId: string) => Promise<Document[]>
        getByQuickTodo: (quickTodoId: string) => Promise<Document[]>
        upload: (taskId: string | null, projectId: string | null, quickTodoId?: string | null) => Promise<UploadResult | null>
        uploadFile: (filePath: string, taskId: string | null, projectId: string | null, quickTodoId?: string | null) => Promise<UploadResult>
        uploadFromClipboard: (base64Data: string, mimeType: string, taskId: string | null, projectId: string | null, quickTodoId?: string | null) => Promise<UploadResult>
        getFilePath: (documentId: string) => Promise<string | null>
        getDataUrl: (documentId: string) => Promise<string | null>
        rename: (documentId: string, newName: string) => Promise<void>
        openExternal: (documentId: string) => Promise<string>
        delete: (id: string) => Promise<void>
        search: (query: string, projectId?: string, taskId?: string) => Promise<DocumentSearchResult[]>
        // Batch methods to prevent N+1 queries
        getByTaskIds: (taskIds: string[]) => Promise<Record<string, Document[]>>
        getByQuickTodoIds: (quickTodoIds: string[]) => Promise<Record<string, Document[]>>
      }
      copilot: {
        chat: (message: string, projectId?: string, taskId?: string, quickTodoId?: string, conversationHistory?: ConversationMessage[]) => Promise<CopilotResponse>
        parseProjectBrainDump: (brainDump: string) => Promise<ParsedProject>
        suggestTaskBreakdown: (taskTitle: string, projectContext?: string) => Promise<string[]>
      }
      quickTodos: {
        getAll: (list?: 'personal' | 'work' | 'tweaks') => Promise<QuickTodo[]>
        getById: (id: string) => Promise<QuickTodo | null>
        getDueToday: () => Promise<QuickTodo[]>
        getOverdue: () => Promise<QuickTodo[]>
        create: (todo: { title: string; list: 'personal' | 'work' | 'tweaks'; description?: string | null; status?: 'todo' | 'in_progress' | 'done'; priority?: 'low' | 'medium' | 'high' | null; due_date?: string | null; parent_quick_todo_id?: string | null }) => Promise<QuickTodo>
        update: (id: string, updates: Partial<{ title: string; description: string | null; list: 'personal' | 'work' | 'tweaks'; status: 'todo' | 'in_progress' | 'done'; priority: 'low' | 'medium' | 'high' | null; due_date: string | null; completed: boolean; recurrence_pattern: RecurrencePattern | null; recurrence_config: string | null; recurrence_end_date: string | null; reminder_time: string | null }>) => Promise<QuickTodo>
        delete: (id: string) => Promise<void>
        getSubtasks: (parentId: string) => Promise<QuickTodo[]>
        // Batch methods to prevent N+1 queries
        getSubtasksByParentIds: (parentIds: string[]) => Promise<Record<string, QuickTodo[]>>
        // Recurrence methods
        getRecurring: (list?: 'personal' | 'work' | 'tweaks') => Promise<QuickTodo[]>
        getInstances: (parentId: string) => Promise<QuickTodo[]>
        createInstance: (parentTodo: QuickTodo, dueDate: string) => Promise<QuickTodo>
        hasInstanceOnDate: (parentId: string, dueDate: string) => Promise<boolean>
        getDueOnDate: (date: string) => Promise<QuickTodo[]>
      }
      sources: {
        getByTask: (taskId: string) => Promise<Source[]>
        getByQuickTodo: (quickTodoId: string) => Promise<Source[]>
        getByProject: (projectId: string) => Promise<Source[]>
        getById: (id: string) => Promise<Source | null>
        create: (source: Omit<Source, 'id' | 'created_at'>) => Promise<Source>
        update: (id: string, updates: Partial<Pick<Source, 'title' | 'description' | 'favicon_url' | 'source_type'>>) => Promise<Source>
        delete: (id: string) => Promise<void>
        fetchMetadata: (url: string) => Promise<UrlMetadata>
        // Batch methods to prevent N+1 queries
        getByTaskIds: (taskIds: string[]) => Promise<Record<string, Source[]>>
        getByQuickTodoIds: (quickTodoIds: string[]) => Promise<Record<string, Source[]>>
      }
      stats: {
        getCompletionStats: () => Promise<CompletionStats>
      }
      notifications: {
        getUpcoming: (days?: number) => Promise<Array<{
          type: 'task' | 'todo'
          parentId: string
          title: string
          dates: string[]
          list?: string
        }>>
        getDueToday: () => Promise<Array<{
          type: 'task' | 'todo'
          item: { id: string; title: string; due_date: string | null }
        }>>
        materialize: (type: 'task' | 'todo', parentId: string) => Promise<{
          success: boolean
          instanceId?: string
          error?: string
        }>
        notifyNow: () => Promise<{ success: boolean }>
        onRecurringNotification: (callback: (notification: {
          id: string
          type: 'task' | 'todo'
          title: string
          message: string
          dueDate: string
          parentId: string
        }) => void) => () => void
      }
      obsidian: {
        selectVaultPath: () => Promise<string | null>
        listFiles: (vaultPath: string) => Promise<VaultFile[]>
        importFiles: (filePaths: string[], projectId: string | null, taskId: string | null, quickTodoId?: string | null) => Promise<ObsidianImportResult>
      }
      onShortcut: (channel: string, callback: () => void) => () => void
    }
  }
}

export {}
