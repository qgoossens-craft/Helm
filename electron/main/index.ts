import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron'
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
    trafficLightPosition: { x: 78, y: 18 },
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

  // Cmd+N - Quick capture to inbox
  globalShortcut.register('CommandOrControl+N', () => {
    mainWindow?.webContents.send('shortcut:quick-capture')
  })

  // Cmd+Shift+F - Focus mode
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    mainWindow?.webContents.send('shortcut:focus-mode')
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
