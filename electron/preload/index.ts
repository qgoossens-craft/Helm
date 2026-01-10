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

export interface Task {
  id: string
  project_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | null
  due_date: string | null
  order: number
  created_at: string
  updated_at: string
  completed_at: string | null
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
      ipcRenderer.invoke('db:tasks:reorder', taskId, newOrder)
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
    update: (id: string, updates: Partial<{ title: string; description: string | null; list: 'personal' | 'work' | 'tweaks'; priority: 'low' | 'medium' | 'high' | null; due_date: string | null; completed: boolean }>): Promise<QuickTodo> =>
      ipcRenderer.invoke('db:quickTodos:update', id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('db:quickTodos:delete', id)
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

  // AI Operations
  copilot: {
    chat: (message: string, projectId?: string, taskId?: string, quickTodoId?: string, conversationHistory?: ConversationMessage[]): Promise<ChatResponse> =>
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
        chat: (message: string, projectId?: string, taskId?: string, conversationHistory?: ConversationMessage[]) => Promise<ChatResponse>
        parseProjectBrainDump: (brainDump: string) => Promise<ParsedProject>
        suggestTaskBreakdown: (taskTitle: string, projectContext?: string) => Promise<string[]>
      }
      quickTodos: {
        getAll: (list?: 'personal' | 'work' | 'tweaks') => Promise<QuickTodo[]>
        getById: (id: string) => Promise<QuickTodo | null>
        getDueToday: () => Promise<QuickTodo[]>
        getOverdue: () => Promise<QuickTodo[]>
        create: (todo: { title: string; list: 'personal' | 'work' | 'tweaks'; description?: string | null; due_date?: string | null }) => Promise<QuickTodo>
        update: (id: string, updates: Partial<{ title: string; description: string | null; list: 'personal' | 'work' | 'tweaks'; priority: 'low' | 'medium' | 'high' | null; due_date: string | null; completed: boolean }>) => Promise<QuickTodo>
        delete: (id: string) => Promise<void>
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
      obsidian: {
        selectVaultPath: () => Promise<string | null>
        listFiles: (vaultPath: string) => Promise<VaultFile[]>
        importFiles: (filePaths: string[], projectId: string | null, taskId: string | null, quickTodoId?: string | null) => Promise<ObsidianImportResult>
      }
      onShortcut: (channel: string, callback: () => void) => () => void
    }
  }
}
