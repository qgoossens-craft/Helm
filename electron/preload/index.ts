import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for the API
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

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

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
  // Recurrence fields
  recurrence_pattern: RecurrencePattern | null
  recurrence_config: string | null
  recurring_parent_id: string | null
  recurrence_end_date: string | null
}

export interface ActivityLogEntry {
  id?: string
  project_id: string | null
  task_id: string | null
  action_type: 'created' | 'updated' | 'completed' | 'viewed' | 'commented'
  details: string | null
  created_at?: string
}

export interface AIConversation {
  id?: string
  project_id: string | null
  task_id: string | null
  user_message: string
  ai_response: string
  feedback?: 'helpful' | 'not_helpful' | null
  created_at?: string
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
  content: string
  suggestions?: SubtaskSuggestion[]
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
  priority: 'low' | 'medium' | 'high' | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  // Recurrence fields
  recurrence_pattern: RecurrencePattern | null
  recurrence_config: string | null
  recurring_parent_id: string | null
  recurrence_end_date: string | null
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

// Expose API to renderer
contextBridge.exposeInMainWorld('api', {
  // Projects
  projects: {
    getAll: (): Promise<Project[]> => ipcRenderer.invoke('db:projects:getAll'),
    getById: (id: string): Promise<Project | null> => ipcRenderer.invoke('db:projects:getById', id),
    create: (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'archived_at'>): Promise<Project> =>
      ipcRenderer.invoke('db:projects:create', project),
    update: (id: string, updates: Partial<Project>): Promise<Project> =>
      ipcRenderer.invoke('db:projects:update', id, updates),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('db:projects:delete', id)
  },

  // Tasks
  tasks: {
    getByProject: (projectId: string | null): Promise<Task[]> =>
      ipcRenderer.invoke('db:tasks:getByProject', projectId),
    getInbox: (): Promise<Task[]> => ipcRenderer.invoke('db:tasks:getInbox'),
    getDeleted: (projectId: string): Promise<Task[]> =>
      ipcRenderer.invoke('db:tasks:getDeleted', projectId),
    getById: (id: string): Promise<Task | null> => ipcRenderer.invoke('db:tasks:getById', id),
    create: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>): Promise<Task> =>
      ipcRenderer.invoke('db:tasks:create', task),
    update: (id: string, updates: Partial<Task>): Promise<Task> =>
      ipcRenderer.invoke('db:tasks:update', id, updates),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('db:tasks:delete', id),
    restore: (id: string): Promise<Task> => ipcRenderer.invoke('db:tasks:restore', id),
    reorder: (taskId: string, newOrder: number): Promise<void> =>
      ipcRenderer.invoke('db:tasks:reorder', taskId, newOrder),
    getCategoriesByProject: (projectId: string): Promise<string[]> =>
      ipcRenderer.invoke('db:tasks:getCategoriesByProject', projectId),
    createSubtasks: (parentTaskId: string, subtasks: Array<{ title: string; description?: string }>): Promise<string[]> =>
      ipcRenderer.invoke('tasks:create-subtasks', parentTaskId, subtasks),
    // Recurrence methods
    getRecurring: (projectId?: string): Promise<Task[]> =>
      ipcRenderer.invoke('db:tasks:getRecurring', projectId),
    getInstances: (parentId: string): Promise<Task[]> =>
      ipcRenderer.invoke('db:tasks:getInstances', parentId),
    createInstance: (parentTask: Task, dueDate: string): Promise<Task> =>
      ipcRenderer.invoke('db:tasks:createInstance', parentTask, dueDate),
    hasInstanceOnDate: (parentId: string, dueDate: string): Promise<boolean> =>
      ipcRenderer.invoke('db:tasks:hasInstanceOnDate', parentId, dueDate),
    getDueOnDate: (date: string): Promise<Task[]> =>
      ipcRenderer.invoke('db:tasks:getDueOnDate', date)
  },

  // Activity Log
  activity: {
    log: (entry: Omit<ActivityLogEntry, 'id' | 'created_at'>): Promise<ActivityLogEntry> =>
      ipcRenderer.invoke('db:activity:log', entry),
    getRecent: (projectId?: string, limit?: number): Promise<ActivityLogEntry[]> =>
      ipcRenderer.invoke('db:activity:getRecent', projectId, limit)
  },

  // Settings
  settings: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('db:settings:get', key),
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('db:settings:set', key, value),
    getAll: (): Promise<Record<string, string>> => ipcRenderer.invoke('db:settings:getAll')
  },

  // AI Conversations (database)
  ai: {
    save: (conversation: Omit<AIConversation, 'id' | 'created_at'>): Promise<AIConversation> =>
      ipcRenderer.invoke('db:ai:save', conversation),
    getByProject: (projectId: string): Promise<AIConversation[]> =>
      ipcRenderer.invoke('db:ai:getByProject', projectId)
  },

  // Documents
  documents: {
    getById: (id: string): Promise<Document | null> =>
      ipcRenderer.invoke('db:documents:getById', id),
    getByTask: (taskId: string): Promise<Document[]> =>
      ipcRenderer.invoke('db:documents:getByTask', taskId),
    getByProject: (projectId: string): Promise<Document[]> =>
      ipcRenderer.invoke('db:documents:getByProject', projectId),
    getByQuickTodo: (quickTodoId: string): Promise<Document[]> =>
      ipcRenderer.invoke('db:documents:getByQuickTodo', quickTodoId),
    upload: (taskId: string | null, projectId: string | null, quickTodoId?: string | null): Promise<UploadResult | null> =>
      ipcRenderer.invoke('documents:upload', taskId, projectId, quickTodoId),
    uploadFile: (filePath: string, taskId: string | null, projectId: string | null, quickTodoId?: string | null): Promise<UploadResult> =>
      ipcRenderer.invoke('documents:uploadFile', filePath, taskId, projectId, quickTodoId),
    uploadFromClipboard: (base64Data: string, mimeType: string, taskId: string | null, projectId: string | null, quickTodoId?: string | null): Promise<UploadResult> =>
      ipcRenderer.invoke('documents:uploadFromClipboard', base64Data, mimeType, taskId, projectId, quickTodoId),
    getFilePath: (documentId: string): Promise<string | null> =>
      ipcRenderer.invoke('documents:getFilePath', documentId),
    getDataUrl: (documentId: string): Promise<string | null> =>
      ipcRenderer.invoke('documents:getDataUrl', documentId),
    rename: (documentId: string, newName: string): Promise<void> =>
      ipcRenderer.invoke('documents:rename', documentId, newName),
    openExternal: (documentId: string): Promise<string> =>
      ipcRenderer.invoke('documents:openExternal', documentId),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('documents:delete', id),
    search: (query: string, projectId?: string, taskId?: string): Promise<DocumentSearchResult[]> =>
      ipcRenderer.invoke('documents:search', query, projectId, taskId)
  },

  // Quick Todos
  quickTodos: {
    getAll: (list?: 'personal' | 'work' | 'tweaks'): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getAll', list),
    getById: (id: string): Promise<QuickTodo | null> =>
      ipcRenderer.invoke('db:quickTodos:getById', id),
    getDueToday: (): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getDueToday'),
    getOverdue: (): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getOverdue'),
    create: (todo: { title: string; list: 'personal' | 'work' | 'tweaks'; description?: string | null; due_date?: string | null }): Promise<QuickTodo> =>
      ipcRenderer.invoke('db:quickTodos:create', todo),
    update: (id: string, updates: Partial<{ title: string; description: string | null; list: 'personal' | 'work' | 'tweaks'; priority: 'low' | 'medium' | 'high' | null; due_date: string | null; completed: boolean; recurrence_pattern: RecurrencePattern | null; recurrence_config: string | null; recurrence_end_date: string | null }>): Promise<QuickTodo> =>
      ipcRenderer.invoke('db:quickTodos:update', id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('db:quickTodos:delete', id),
    // Recurrence methods
    getRecurring: (list?: 'personal' | 'work' | 'tweaks'): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getRecurring', list),
    getInstances: (parentId: string): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getInstances', parentId),
    createInstance: (parentTodo: QuickTodo, dueDate: string): Promise<QuickTodo> =>
      ipcRenderer.invoke('db:quickTodos:createInstance', parentTodo, dueDate),
    hasInstanceOnDate: (parentId: string, dueDate: string): Promise<boolean> =>
      ipcRenderer.invoke('db:quickTodos:hasInstanceOnDate', parentId, dueDate),
    getDueOnDate: (date: string): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getDueOnDate', date)
  },

  // Sources (URL links)
  sources: {
    getByTask: (taskId: string): Promise<Source[]> =>
      ipcRenderer.invoke('db:sources:getByTask', taskId),
    getByQuickTodo: (quickTodoId: string): Promise<Source[]> =>
      ipcRenderer.invoke('db:sources:getByQuickTodo', quickTodoId),
    getByProject: (projectId: string): Promise<Source[]> =>
      ipcRenderer.invoke('db:sources:getByProject', projectId),
    getById: (id: string): Promise<Source | null> =>
      ipcRenderer.invoke('db:sources:getById', id),
    create: (source: Omit<Source, 'id' | 'created_at'>): Promise<Source> =>
      ipcRenderer.invoke('db:sources:create', source),
    update: (id: string, updates: Partial<Pick<Source, 'title' | 'description' | 'favicon_url' | 'source_type'>>): Promise<Source> =>
      ipcRenderer.invoke('db:sources:update', id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('db:sources:delete', id),
    fetchMetadata: (url: string): Promise<UrlMetadata> =>
      ipcRenderer.invoke('sources:fetchMetadata', url)
  },

  // Stats
  stats: {
    getCompletionStats: (): Promise<CompletionStats> =>
      ipcRenderer.invoke('db:stats:getCompletionStats')
  },

  // Notifications / Recurring Items
  notifications: {
    getUpcoming: (days?: number): Promise<Array<{
      type: 'task' | 'todo'
      parentId: string
      title: string
      dates: string[]
      list?: string
    }>> => ipcRenderer.invoke('notifications:getUpcoming', days),
    getDueToday: (): Promise<Array<{
      type: 'task' | 'todo'
      item: { id: string; title: string; due_date: string | null }
    }>> => ipcRenderer.invoke('notifications:getDueToday'),
    materialize: (type: 'task' | 'todo', parentId: string): Promise<{
      success: boolean
      instanceId?: string
      error?: string
    }> => ipcRenderer.invoke('notifications:materialize', type, parentId),
    notifyNow: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('notifications:notifyNow'),
    onRecurringNotification: (callback: (notification: {
      id: string
      type: 'task' | 'todo'
      title: string
      message: string
      dueDate: string
      parentId: string
    }) => void) => {
      ipcRenderer.on('notification:recurring', (_, notification) => callback(notification))
      return () => ipcRenderer.removeListener('notification:recurring', callback)
    }
  },

  // AI Operations
  copilot: {
    chat: (message: string, projectId?: string, taskId?: string, quickTodoId?: string, conversationHistory?: ConversationMessage[]): Promise<CopilotResponse> =>
      ipcRenderer.invoke('ai:chat', message, projectId, taskId, quickTodoId, conversationHistory),
    parseProjectBrainDump: (brainDump: string): Promise<ParsedProject> =>
      ipcRenderer.invoke('ai:parseProjectBrainDump', brainDump),
    suggestTaskBreakdown: (taskTitle: string, projectContext?: string): Promise<string[]> =>
      ipcRenderer.invoke('ai:suggestTaskBreakdown', taskTitle, projectContext)
  },

  // Obsidian Integration
  obsidian: {
    selectVaultPath: (): Promise<string | null> =>
      ipcRenderer.invoke('obsidian:selectVaultPath'),
    listFiles: (vaultPath: string): Promise<VaultFile[]> =>
      ipcRenderer.invoke('obsidian:listFiles', vaultPath),
    importFiles: (filePaths: string[], projectId: string | null, taskId: string | null, quickTodoId?: string | null): Promise<ObsidianImportResult> =>
      ipcRenderer.invoke('obsidian:importFiles', filePaths, projectId, taskId, quickTodoId)
  },

  // Event listeners for shortcuts
  onShortcut: (channel: string, callback: () => void) => {
    const validChannels = ['shortcut:copilot', 'shortcut:quick-capture', 'shortcut:focus-mode', 'shortcut:global-capture']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback)
      return () => ipcRenderer.removeListener(channel, callback)
    }
    return () => {}
  }
})

// Type declaration for window.api
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
        getCategoriesByProject: (projectId: string) => Promise<string[]>
        createSubtasks: (parentTaskId: string, subtasks: Array<{ title: string; description?: string }>) => Promise<string[]>
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
        delete: (id: string) => Promise<void>
        search: (query: string, projectId?: string, taskId?: string) => Promise<DocumentSearchResult[]>
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
        create: (todo: { title: string; list: 'personal' | 'work' | 'tweaks'; description?: string | null; due_date?: string | null }) => Promise<QuickTodo>
        update: (id: string, updates: Partial<{ title: string; description: string | null; list: 'personal' | 'work' | 'tweaks'; priority: 'low' | 'medium' | 'high' | null; due_date: string | null; completed: boolean; recurrence_pattern: RecurrencePattern | null; recurrence_config: string | null; recurrence_end_date: string | null }>) => Promise<QuickTodo>
        delete: (id: string) => Promise<void>
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
