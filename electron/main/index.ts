import { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell } from 'electron'
import { join } from 'path'
import { initDatabase, db } from '../database/db'
import * as ai from '../services/ai'
import * as documents from '../services/documents'

let mainWindow: BrowserWindow | null = null

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
      sandbox: false
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

  // Activity Log
  ipcMain.handle('db:activity:log', (_, entry) => db.activityLog.log(entry))
  ipcMain.handle('db:activity:getRecent', (_, projectId?: string, limit?: number) =>
    db.activityLog.getRecent(projectId, limit))

  // Settings
  ipcMain.handle('db:settings:get', (_, key: string) => db.settings.get(key))
  ipcMain.handle('db:settings:set', (_, key: string, value: string) => db.settings.set(key, value))
  ipcMain.handle('db:settings:getAll', () => db.settings.getAll())

  // AI Conversations (database)
  ipcMain.handle('db:ai:save', (_, conversation) => db.aiConversations.save(conversation))
  ipcMain.handle('db:ai:getByProject', (_, projectId: string) => db.aiConversations.getByProject(projectId))

  // Documents (database)
  ipcMain.handle('db:documents:getById', (_, id: string) => db.documents.getById(id))
  ipcMain.handle('db:documents:getByTask', (_, taskId: string) => db.documents.getByTask(taskId))
  ipcMain.handle('db:documents:getByProject', (_, projectId: string) => db.documents.getByProject(projectId))

  // Document upload and processing
  ipcMain.handle('documents:upload', async (_, taskId: string | null, projectId: string | null) => {
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
    return documents.processUpload(filePath, taskId, projectId)
  })

  ipcMain.handle('documents:uploadFile', async (_, filePath: string, taskId: string | null, projectId: string | null) => {
    return documents.processUpload(filePath, taskId, projectId)
  })

  ipcMain.handle('documents:delete', async (_, documentId: string) => {
    documents.deleteDocument(documentId)
  })

  ipcMain.handle('documents:search', async (_, query: string, projectId?: string, taskId?: string) => {
    return documents.searchDocuments(query, { projectId, taskId })
  })

  ipcMain.handle('documents:uploadFromClipboard', async (_, base64Data: string, mimeType: string, taskId: string | null, projectId: string | null) => {
    return documents.processClipboardUpload(base64Data, mimeType, taskId, projectId)
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

  // AI Operations
  ipcMain.handle('ai:chat', async (_, message: string, projectId?: string, taskId?: string) => {
    return ai.chat(message, projectId, taskId)
  })

  ipcMain.handle('ai:parseProjectBrainDump', async (_, brainDump: string) => {
    return ai.parseProjectBrainDump(brainDump)
  })

  ipcMain.handle('ai:suggestTaskBreakdown', async (_, taskTitle: string, projectContext?: string) => {
    return ai.suggestTaskBreakdown(taskTitle, projectContext)
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
    return documents.listObsidianFiles(vaultPath)
  })

  ipcMain.handle('obsidian:importFiles', async (_, filePaths: string[], projectId: string | null, taskId: string | null) => {
    return documents.importObsidianFiles(filePaths, projectId, taskId)
  })
}

app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerIpcHandlers()

  // Create window
  createWindow()

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
})
