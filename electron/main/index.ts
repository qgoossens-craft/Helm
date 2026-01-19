import { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell, net } from 'electron'
import { join, resolve, normalize } from 'path'
import { initDatabase, db } from '../database/db'
import * as ai from '../services/ai'
import * as documents from '../services/documents'
import * as notifications from '../services/notifications'
import * as credentials from '../services/credentials'

let mainWindow: BrowserWindow | null = null

// Security: Validate file paths to prevent path traversal attacks
function isPathWithinAllowedDirectories(filePath: string): boolean {
  const normalizedPath = normalize(resolve(filePath))

  // Allowed base directories
  const allowedBases = [
    app.getPath('userData'),    // App data directory
    app.getPath('documents'),   // User documents
    app.getPath('downloads'),   // Downloads folder
    app.getPath('temp'),        // Temp directory
    app.getPath('home'),        // Home directory (for Obsidian vaults)
  ]

  return allowedBases.some(base => normalizedPath.startsWith(normalize(base)))
}

function validateFilePath(filePath: string, operation: string): void {
  if (!isPathWithinAllowedDirectories(filePath)) {
    throw new Error(`Security: ${operation} blocked - path "${filePath}" is outside allowed directories`)
  }
}

// URL metadata fetching
interface UrlMetadata {
  title: string
  description: string | null
  favicon_url: string | null
  source_type: 'link' | 'article' | 'video' | 'document'
}

async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
  const MAX_HTML_READ = 100 * 1024 // 100KB for metadata parsing
  const TIMEOUT_MS = 10000 // 10 seconds

  try {
    // Normalize URL
    let normalizedUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = 'https://' + url
    }

    const parsedUrl = new URL(normalizedUrl)
    const hostname = parsedUrl.hostname

    // Detect source type from URL
    let sourceType: UrlMetadata['source_type'] = 'link'
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be') || hostname.includes('vimeo.com')) {
      sourceType = 'video'
    } else if (hostname.includes('medium.com') || hostname.includes('dev.to') || hostname.includes('hashnode.') || url.includes('/blog/') || url.includes('/article/')) {
      sourceType = 'article'
    } else if (url.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)) {
      sourceType = 'document'
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await net.fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Check response size from Content-Length header
      const contentLength = response.headers.get('Content-Length')
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        console.warn(`Response too large (${contentLength} bytes) for URL: ${url}`)
        return {
          title: hostname,
          description: null,
          favicon_url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
          source_type: sourceType
        }
      }

      if (!response.ok) {
        return {
          title: hostname,
          description: null,
          favicon_url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
          source_type: sourceType
        }
      }

      // Read only the first MAX_HTML_READ bytes for metadata parsing
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      let html = ''
      let totalRead = 0
      const decoder = new TextDecoder()

      while (totalRead < MAX_HTML_READ) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        totalRead += value.length
      }
      reader.cancel() // Stop reading after we have enough

      // Extract title
      let title = hostname
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        title = titleMatch[1].trim()
        // Decode HTML entities
        title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      }

      // Extract description from meta tags
      let description: string | null = null
      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      if (ogDescMatch) {
        description = ogDescMatch[1].trim()
      } else if (metaDescMatch) {
        description = metaDescMatch[1].trim()
      }
      if (description) {
        description = description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      }

      // Extract favicon - try multiple sources
      let faviconUrl: string | null = null
      const iconLinkMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
      const appleTouchMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i)

      if (iconLinkMatch) {
        faviconUrl = iconLinkMatch[1]
      } else if (appleTouchMatch) {
        faviconUrl = appleTouchMatch[1]
      }

      // Make favicon URL absolute if relative
      if (faviconUrl && !faviconUrl.startsWith('http')) {
        if (faviconUrl.startsWith('//')) {
          faviconUrl = 'https:' + faviconUrl
        } else if (faviconUrl.startsWith('/')) {
          faviconUrl = `${parsedUrl.protocol}//${parsedUrl.host}${faviconUrl}`
        } else {
          faviconUrl = `${parsedUrl.protocol}//${parsedUrl.host}/${faviconUrl}`
        }
      }

      // Fallback to Google's favicon service
      if (!faviconUrl) {
        faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
      }

      return {
        title,
        description,
        favicon_url: faviconUrl,
        source_type: sourceType
      }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error('Failed to fetch URL metadata:', error)
    // Return basic metadata with domain as title
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : 'https://' + url)
      return {
        title: parsedUrl.hostname,
        description: null,
        favicon_url: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=32`,
        source_type: 'link'
      }
    } catch {
      return {
        title: url,
        description: null,
        favicon_url: null,
        source_type: 'link'
      }
    }
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 13, y: 13 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerGlobalShortcuts(): void {
  // Cmd+K - Open copilot
  globalShortcut.register('CommandOrControl+K', () => {
    mainWindow?.webContents.send('shortcut:copilot')
  })

  // Cmd+Shift+F - Focus mode
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    mainWindow?.webContents.send('shortcut:focus-mode')
  })

  // Cmd+Enter - Global quick capture (works even when app is not focused)
  globalShortcut.register('CommandOrControl+Return', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
    mainWindow?.webContents.send('shortcut:global-capture')
  })
}

// Register IPC handlers for database operations
function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle('db:projects:getAll', () => db.projects.getAll())
  ipcMain.handle('db:projects:getById', (_, id: string) => db.projects.getById(id))
  ipcMain.handle('db:projects:create', (_, project) => db.projects.create(project))
  ipcMain.handle('db:projects:update', (_, id: string, updates) => db.projects.update(id, updates))
  ipcMain.handle('db:projects:delete', (_, id: string) => db.projects.delete(id))

  // Tasks
  ipcMain.handle('db:tasks:getByProject', (_, projectId: string | null) => db.tasks.getByProject(projectId))
  ipcMain.handle('db:tasks:getInbox', () => db.tasks.getInbox())
  ipcMain.handle('db:tasks:getById', (_, id: string) => db.tasks.getById(id))
  ipcMain.handle('db:tasks:create', (_, task) => db.tasks.create(task))
  ipcMain.handle('db:tasks:update', (_, id: string, updates) => db.tasks.update(id, updates))
  ipcMain.handle('db:tasks:delete', (_, id: string) => db.tasks.delete(id))
  ipcMain.handle('db:tasks:getDeleted', (_, projectId: string) => db.tasks.getDeleted(projectId))
  ipcMain.handle('db:tasks:restore', (_, id: string) => db.tasks.restore(id))
  ipcMain.handle('db:tasks:reorder', (_, taskId: string, newOrder: number) => db.tasks.reorder(taskId, newOrder))
  ipcMain.handle('db:tasks:getCategoriesByProject', (_, projectId: string) => db.tasks.getCategoriesByProject(projectId))
  // Batch methods to prevent N+1 queries
  ipcMain.handle('db:tasks:getSubtasksByParentIds', (_, parentIds: string[]) => db.tasks.getSubtasksByParentIds(parentIds))
  ipcMain.handle('db:tasks:getAllWithDueDate', () => db.tasks.getAllWithDueDate())

  // Task Recurrence
  ipcMain.handle('db:tasks:getRecurring', (_, projectId?: string) => db.tasks.getRecurring(projectId))
  ipcMain.handle('db:tasks:getInstances', (_, parentId: string) => db.tasks.getInstances(parentId))
  ipcMain.handle('db:tasks:createInstance', (_, parentTask, dueDate: string) => db.tasks.createInstance(parentTask, dueDate))
  ipcMain.handle('db:tasks:hasInstanceOnDate', (_, parentId: string, dueDate: string) => db.tasks.hasInstanceOnDate(parentId, dueDate))
  ipcMain.handle('db:tasks:getDueOnDate', (_, date: string) => db.tasks.getDueOnDate(date))

  // Activity Log
  ipcMain.handle('db:activity:log', (_, entry) => db.activityLog.log(entry))
  ipcMain.handle('db:activity:getRecent', (_, projectId?: string, limit?: number) =>
    db.activityLog.getRecent(projectId, limit))

  // Settings
  ipcMain.handle('db:settings:get', (_, key: string) => db.settings.get(key))
  ipcMain.handle('db:settings:set', (_, key: string, value: string) => db.settings.set(key, value))
  ipcMain.handle('db:settings:getAll', () => db.settings.getAll())

  // Secure settings (encrypted)
  ipcMain.handle('db:settings:setSecure', (_, key: string, value: string) => {
    credentials.setApiKey(key, value)
  })
  ipcMain.handle('db:settings:getSecure', (_, key: string) => {
    return credentials.getApiKey(key)
  })
  ipcMain.handle('db:settings:isEncryptionAvailable', () => {
    return credentials.isEncryptionAvailable()
  })

  // AI Conversations (database)
  ipcMain.handle('db:ai:save', (_, conversation) => db.aiConversations.save(conversation))
  ipcMain.handle('db:ai:getByProject', (_, projectId: string) => db.aiConversations.getByProject(projectId))

  // Documents (database)
  ipcMain.handle('db:documents:getById', (_, id: string) => db.documents.getById(id))
  ipcMain.handle('db:documents:getByTask', (_, taskId: string) => db.documents.getByTask(taskId))
  ipcMain.handle('db:documents:getByProject', (_, projectId: string) => db.documents.getByProject(projectId))
  ipcMain.handle('db:documents:getByQuickTodo', (_, quickTodoId: string) => db.documents.getByQuickTodo(quickTodoId))
  // Batch methods to prevent N+1 queries
  ipcMain.handle('db:documents:getByTaskIds', (_, taskIds: string[]) => db.documents.getByTaskIds(taskIds))
  ipcMain.handle('db:documents:getByQuickTodoIds', (_, quickTodoIds: string[]) => db.documents.getByQuickTodoIds(quickTodoIds))

  // Document upload and processing
  ipcMain.handle('documents:upload', async (_, taskId: string | null, projectId: string | null, quickTodoId?: string | null) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'All Supported', extensions: ['pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    return documents.processUpload(filePath, taskId, projectId, quickTodoId)
  })

  ipcMain.handle('documents:uploadFile', async (_, filePath: string, taskId: string | null, projectId: string | null, quickTodoId?: string | null) => {
    validateFilePath(filePath, 'document upload')
    return documents.processUpload(filePath, taskId, projectId, quickTodoId)
  })

  ipcMain.handle('documents:delete', async (_, documentId: string) => {
    documents.deleteDocument(documentId)
  })

  ipcMain.handle('documents:search', async (_, query: string, projectId?: string, taskId?: string) => {
    return documents.searchDocuments(query, { projectId, taskId })
  })

  ipcMain.handle('documents:uploadFromClipboard', async (_, base64Data: string, mimeType: string, taskId: string | null, projectId: string | null, quickTodoId?: string | null) => {
    return documents.processClipboardUpload(base64Data, mimeType, taskId, projectId, quickTodoId)
  })

  ipcMain.handle('documents:getFilePath', async (_, documentId: string) => {
    return documents.getDocumentFilePath(documentId)
  })

  ipcMain.handle('documents:getDataUrl', async (_, documentId: string) => {
    return documents.getDocumentDataUrl(documentId)
  })

  ipcMain.handle('documents:rename', async (_, documentId: string, newName: string) => {
    return documents.renameDocument(documentId, newName)
  })

  ipcMain.handle('documents:openExternal', async (_, documentId: string) => {
    const filePath = documents.getDocumentFilePath(documentId)
    if (filePath) {
      return shell.openPath(filePath)
    }
    return 'File not found'
  })

  // Quick Todos
  ipcMain.handle('db:quickTodos:getAll', (_, list?: 'personal' | 'work' | 'tweaks') => db.quickTodos.getAll(list))
  ipcMain.handle('db:quickTodos:getById', (_, id: string) => db.quickTodos.getById(id))
  ipcMain.handle('db:quickTodos:getDueToday', () => db.quickTodos.getDueToday())
  ipcMain.handle('db:quickTodos:getOverdue', () => db.quickTodos.getOverdue())
  ipcMain.handle('db:quickTodos:create', (_, todo) => db.quickTodos.create(todo))
  ipcMain.handle('db:quickTodos:update', (_, id: string, updates) => db.quickTodos.update(id, updates))
  ipcMain.handle('db:quickTodos:delete', (_, id: string) => db.quickTodos.delete(id))
  ipcMain.handle('db:quickTodos:getSubtasks', (_, parentId: string) => db.quickTodos.getSubtasks(parentId))
  // Batch method to prevent N+1 queries
  ipcMain.handle('db:quickTodos:getSubtasksByParentIds', (_, parentIds: string[]) => db.quickTodos.getSubtasksByParentIds(parentIds))

  // QuickTodos Recurrence
  ipcMain.handle('db:quickTodos:getRecurring', (_, list?: 'personal' | 'work' | 'tweaks') => db.quickTodos.getRecurring(list))
  ipcMain.handle('db:quickTodos:getInstances', (_, parentId: string) => db.quickTodos.getInstances(parentId))
  ipcMain.handle('db:quickTodos:createInstance', (_, parentTodo, dueDate: string) => db.quickTodos.createInstance(parentTodo, dueDate))
  ipcMain.handle('db:quickTodos:hasInstanceOnDate', (_, parentId: string, dueDate: string) => db.quickTodos.hasInstanceOnDate(parentId, dueDate))
  ipcMain.handle('db:quickTodos:getDueOnDate', (_, date: string) => db.quickTodos.getDueOnDate(date))

  // Sources (URL links)
  ipcMain.handle('db:sources:getByTask', (_, taskId: string) => db.sources.getByTask(taskId))
  ipcMain.handle('db:sources:getByQuickTodo', (_, quickTodoId: string) => db.sources.getByQuickTodo(quickTodoId))
  ipcMain.handle('db:sources:getByProject', (_, projectId: string) => db.sources.getByProject(projectId))
  ipcMain.handle('db:sources:getById', (_, id: string) => db.sources.getById(id))
  ipcMain.handle('db:sources:create', (_, source) => db.sources.create(source))
  ipcMain.handle('db:sources:update', (_, id: string, updates) => db.sources.update(id, updates))
  ipcMain.handle('db:sources:delete', (_, id: string) => db.sources.delete(id))
  // Batch methods to prevent N+1 queries
  ipcMain.handle('db:sources:getByTaskIds', (_, taskIds: string[]) => db.sources.getByTaskIds(taskIds))
  ipcMain.handle('db:sources:getByQuickTodoIds', (_, quickTodoIds: string[]) => db.sources.getByQuickTodoIds(quickTodoIds))

  // Recurring completions
  ipcMain.handle('db:recurringCompletions:complete', (_, parentId: string, parentType: 'task' | 'todo', completionDate: string) =>
    db.recurringCompletions.complete(parentId, parentType, completionDate))
  ipcMain.handle('db:recurringCompletions:uncomplete', (_, parentId: string, completionDate: string) =>
    db.recurringCompletions.uncomplete(parentId, completionDate))
  ipcMain.handle('db:recurringCompletions:isCompleted', (_, parentId: string, completionDate: string) =>
    db.recurringCompletions.isCompleted(parentId, completionDate))
  ipcMain.handle('db:recurringCompletions:getCompletionsInRange', (_, startDate: string, endDate: string) =>
    db.recurringCompletions.getCompletionsInRange(startDate, endDate))

  // Sources - URL metadata fetching
  ipcMain.handle('sources:fetchMetadata', async (_, url: string) => {
    return fetchUrlMetadata(url)
  })

  // Stats
  ipcMain.handle('db:stats:getCompletionStats', () => db.stats.getCompletionStats())

  // Notifications / Recurring Items
  ipcMain.handle('notifications:getUpcoming', (_, days?: number) =>
    notifications.getUpcomingRecurringItems(days))
  ipcMain.handle('notifications:getDueToday', () =>
    notifications.getItemsDueToday())
  ipcMain.handle('notifications:materialize', (_, type: 'task' | 'todo', parentId: string) =>
    notifications.materializeRecurringItem(type, parentId))
  ipcMain.handle('notifications:notifyNow', () => {
    notifications.notifyDueItems()
    return { success: true }
  })

  // AI Operations
  ipcMain.handle('ai:chat', async (_, message: string, projectId?: string, taskId?: string, quickTodoId?: string, conversationHistory?: ai.ConversationMessage[]) => {
    return ai.chat(message, projectId, taskId, quickTodoId, conversationHistory || [])
  })

  ipcMain.handle('ai:parseProjectBrainDump', async (_, brainDump: string) => {
    return ai.parseProjectBrainDump(brainDump)
  })

  ipcMain.handle('ai:suggestTaskBreakdown', async (_, taskTitle: string, projectContext?: string) => {
    return ai.suggestTaskBreakdown(taskTitle, projectContext)
  })

  // Create multiple subtasks for a parent task
  ipcMain.handle('tasks:create-subtasks', async (_, parentTaskId: string, subtasks: Array<{ title: string; description?: string }>) => {
    const createdIds: string[] = []

    // Get parent task to inherit project_id
    const parentTask = db.tasks.getById(parentTaskId)
    const projectId = parentTask?.project_id || null

    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i]
      const created = db.tasks.create({
        title: subtask.title,
        description: subtask.description || null,
        project_id: projectId,
        parent_task_id: parentTaskId,
        status: 'todo',
        priority: null,
        due_date: null,
        category: null,
        order: i,
        deleted_at: null
      })
      createdIds.push(created.id)
    }

    return createdIds
  })

  // Obsidian Integration
  ipcMain.handle('obsidian:selectVaultPath', async () => {
    const win = mainWindow || BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Obsidian Vault',
      message: 'Choose your Obsidian vault folder'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('obsidian:listFiles', async (_, vaultPath: string) => {
    validateFilePath(vaultPath, 'Obsidian vault listing')
    return documents.listObsidianFiles(vaultPath)
  })

  ipcMain.handle('obsidian:importFiles', async (_, filePaths: string[], projectId: string | null, taskId: string | null, quickTodoId?: string | null) => {
    for (const fp of filePaths) {
      validateFilePath(fp, 'Obsidian import')
    }
    return documents.importObsidianFiles(filePaths, projectId, taskId, quickTodoId)
  })
}

app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerIpcHandlers()

  // Create window
  createWindow()

  // Set main window for notifications and start scheduler
  if (mainWindow) {
    notifications.setMainWindow(mainWindow)
    notifications.startNotificationScheduler()
  }

  // Register shortcuts
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  notifications.stopNotificationScheduler()
})
