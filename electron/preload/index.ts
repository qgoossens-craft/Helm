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

export interface QuickTodo {
  id: string
  title: string
  list: 'personal' | 'work'
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
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
    upload: (taskId: string | null, projectId: string | null): Promise<UploadResult | null> =>
      ipcRenderer.invoke('documents:upload', taskId, projectId),
    uploadFile: (filePath: string, taskId: string | null, projectId: string | null): Promise<UploadResult> =>
      ipcRenderer.invoke('documents:uploadFile', filePath, taskId, projectId),
    uploadFromClipboard: (base64Data: string, mimeType: string, taskId: string | null, projectId: string | null): Promise<UploadResult> =>
      ipcRenderer.invoke('documents:uploadFromClipboard', base64Data, mimeType, taskId, projectId),
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
    getAll: (list?: 'personal' | 'work'): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getAll', list),
    getById: (id: string): Promise<QuickTodo | null> =>
      ipcRenderer.invoke('db:quickTodos:getById', id),
    getDueToday: (): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getDueToday'),
    getOverdue: (): Promise<QuickTodo[]> =>
      ipcRenderer.invoke('db:quickTodos:getOverdue'),
    create: (todo: { title: string; list: 'personal' | 'work'; due_date?: string | null }): Promise<QuickTodo> =>
      ipcRenderer.invoke('db:quickTodos:create', todo),
    update: (id: string, updates: Partial<{ title: string; list: 'personal' | 'work'; due_date: string | null; completed: boolean }>): Promise<QuickTodo> =>
      ipcRenderer.invoke('db:quickTodos:update', id, updates),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('db:quickTodos:delete', id)
  },

  // AI Operations
  copilot: {
    chat: (message: string, projectId?: string, taskId?: string): Promise<ChatResponse> =>
      ipcRenderer.invoke('ai:chat', message, projectId, taskId),
    parseProjectBrainDump: (brainDump: string): Promise<ParsedProject> =>
      ipcRenderer.invoke('ai:parseProjectBrainDump', brainDump),
    suggestTaskBreakdown: (taskTitle: string, projectContext?: string): Promise<string[]> =>
      ipcRenderer.invoke('ai:suggestTaskBreakdown', taskTitle, projectContext)
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
        upload: (taskId: string | null, projectId: string | null) => Promise<UploadResult | null>
        uploadFile: (filePath: string, taskId: string | null, projectId: string | null) => Promise<UploadResult>
        uploadFromClipboard: (base64Data: string, mimeType: string, taskId: string | null, projectId: string | null) => Promise<UploadResult>
        getFilePath: (documentId: string) => Promise<string | null>
        getDataUrl: (documentId: string) => Promise<string | null>
        rename: (documentId: string, newName: string) => Promise<void>
        delete: (id: string) => Promise<void>
        search: (query: string, projectId?: string, taskId?: string) => Promise<DocumentSearchResult[]>
      }
      copilot: {
        chat: (message: string, projectId?: string, taskId?: string) => Promise<ChatResponse>
        parseProjectBrainDump: (brainDump: string) => Promise<ParsedProject>
        suggestTaskBreakdown: (taskTitle: string, projectContext?: string) => Promise<string[]>
      }
      quickTodos: {
        getAll: (list?: 'personal' | 'work') => Promise<QuickTodo[]>
        getById: (id: string) => Promise<QuickTodo | null>
        getDueToday: () => Promise<QuickTodo[]>
        getOverdue: () => Promise<QuickTodo[]>
        create: (todo: { title: string; list: 'personal' | 'work'; due_date?: string | null }) => Promise<QuickTodo>
        update: (id: string, updates: Partial<{ title: string; list: 'personal' | 'work'; due_date: string | null; completed: boolean }>) => Promise<QuickTodo>
        delete: (id: string) => Promise<void>
      }
      onShortcut: (channel: string, callback: () => void) => () => void
    }
  }
}
