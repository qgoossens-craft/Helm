import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let database: Database.Database | null = null

// Get database path
function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'helm.db')
}

// Initialize database
export function initDatabase(): void {
  const dbPath = getDbPath()
  database = new Database(dbPath)

  // Enable foreign keys
  database.pragma('foreign_keys = ON')

  // Read and execute schema
  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')

  // Execute the entire schema at once
  try {
    database.exec(schema)
  } catch (error) {
    // Only log if it's not about existing tables
    if (!String(error).includes('already exists')) {
      console.error('Schema initialization error:', error)
    }
  }

  console.log('Database initialized at:', dbPath)
}

// Get database instance
function getDb(): Database.Database {
  if (!database) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return database
}

// Generate UUID
function generateId(): string {
  return randomUUID()
}

// Get current ISO timestamp
function now(): string {
  return new Date().toISOString()
}

// Type definitions
interface Project {
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

interface Task {
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

interface ActivityLogEntry {
  id: string
  project_id: string | null
  task_id: string | null
  action_type: 'created' | 'updated' | 'completed' | 'viewed' | 'commented'
  details: string | null
  created_at: string
}

interface AIConversation {
  id: string
  project_id: string | null
  task_id: string | null
  user_message: string
  ai_response: string
  feedback: 'helpful' | 'not_helpful' | null
  created_at: string
}

interface Document {
  id: string
  project_id: string | null
  task_id: string | null
  name: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
}

// Database operations
export const db = {
  // Projects
  projects: {
    getAll(): Project[] {
      const stmt = getDb().prepare(`
        SELECT * FROM projects
        WHERE archived_at IS NULL
        ORDER BY updated_at DESC
      `)
      return stmt.all() as Project[]
    },

    getById(id: string): Project | null {
      const stmt = getDb().prepare('SELECT * FROM projects WHERE id = ?')
      return (stmt.get(id) as Project) || null
    },

    create(project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'archived_at'>): Project {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO projects (id, name, why, done_definition, status, context, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        project.name,
        project.why,
        project.done_definition,
        project.status || 'active',
        project.context || 'personal',
        timestamp,
        timestamp
      )

      return this.getById(id)!
    },

    update(id: string, updates: Partial<Project>): Project {
      const current = this.getById(id)
      if (!current) throw new Error(`Project ${id} not found`)

      const fields: string[] = []
      const values: (string | null)[] = []

      if (updates.name !== undefined) {
        fields.push('name = ?')
        values.push(updates.name)
      }
      if (updates.why !== undefined) {
        fields.push('why = ?')
        values.push(updates.why)
      }
      if (updates.done_definition !== undefined) {
        fields.push('done_definition = ?')
        values.push(updates.done_definition)
      }
      if (updates.status !== undefined) {
        fields.push('status = ?')
        values.push(updates.status)
      }
      if (updates.context !== undefined) {
        fields.push('context = ?')
        values.push(updates.context)
      }
      if (updates.archived_at !== undefined) {
        fields.push('archived_at = ?')
        values.push(updates.archived_at)
      }

      fields.push('updated_at = ?')
      values.push(now())
      values.push(id)

      const stmt = getDb().prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`)
      stmt.run(...values)

      return this.getById(id)!
    },

    delete(id: string): void {
      const stmt = getDb().prepare('DELETE FROM projects WHERE id = ?')
      stmt.run(id)
    }
  },

  // Tasks
  tasks: {
    getByProject(projectId: string | null): Task[] {
      const stmt = getDb().prepare(`
        SELECT * FROM tasks
        WHERE project_id ${projectId === null ? 'IS NULL' : '= ?'}
        ORDER BY "order" ASC, created_at ASC
      `)
      return (projectId === null ? stmt.all() : stmt.all(projectId)) as Task[]
    },

    getInbox(): Task[] {
      const stmt = getDb().prepare(`
        SELECT * FROM tasks
        WHERE project_id IS NULL
        ORDER BY created_at DESC
      `)
      return stmt.all() as Task[]
    },

    getById(id: string): Task | null {
      const stmt = getDb().prepare('SELECT * FROM tasks WHERE id = ?')
      return (stmt.get(id) as Task) || null
    },

    create(task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at'>): Task {
      const id = generateId()
      const timestamp = now()

      // Get next order number
      const orderStmt = getDb().prepare(`
        SELECT COALESCE(MAX("order"), -1) + 1 as next_order
        FROM tasks
        WHERE project_id ${task.project_id === null ? 'IS NULL' : '= ?'}
      `)
      const orderResult = task.project_id === null
        ? orderStmt.get() as { next_order: number }
        : orderStmt.get(task.project_id) as { next_order: number }
      const order = task.order ?? orderResult.next_order

      const stmt = getDb().prepare(`
        INSERT INTO tasks (id, project_id, parent_task_id, title, description, status, "order", created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        task.project_id,
        task.parent_task_id,
        task.title,
        task.description,
        task.status || 'todo',
        order,
        timestamp,
        timestamp
      )

      return this.getById(id)!
    },

    update(id: string, updates: Partial<Task>): Task {
      const current = this.getById(id)
      if (!current) throw new Error(`Task ${id} not found`)

      const fields: string[] = []
      const values: (string | number | null)[] = []

      if (updates.project_id !== undefined) {
        fields.push('project_id = ?')
        values.push(updates.project_id)
      }
      if (updates.parent_task_id !== undefined) {
        fields.push('parent_task_id = ?')
        values.push(updates.parent_task_id)
      }
      if (updates.title !== undefined) {
        fields.push('title = ?')
        values.push(updates.title)
      }
      if (updates.description !== undefined) {
        fields.push('description = ?')
        values.push(updates.description)
      }
      if (updates.status !== undefined) {
        fields.push('status = ?')
        values.push(updates.status)

        // Set completed_at when status changes to done
        if (updates.status === 'done' && current.status !== 'done') {
          fields.push('completed_at = ?')
          values.push(now())
        } else if (updates.status !== 'done' && current.status === 'done') {
          fields.push('completed_at = ?')
          values.push(null)
        }
      }
      if (updates.order !== undefined) {
        fields.push('"order" = ?')
        values.push(updates.order)
      }

      fields.push('updated_at = ?')
      values.push(now())
      values.push(id)

      const stmt = getDb().prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`)
      stmt.run(...values)

      return this.getById(id)!
    },

    delete(id: string): void {
      const stmt = getDb().prepare('DELETE FROM tasks WHERE id = ?')
      stmt.run(id)
    },

    reorder(taskId: string, newOrder: number): void {
      const task = this.getById(taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)

      const updateStmt = getDb().prepare('UPDATE tasks SET "order" = ? WHERE id = ?')
      updateStmt.run(newOrder, taskId)
    }
  },

  // Activity Log
  activityLog: {
    log(entry: Omit<ActivityLogEntry, 'id' | 'created_at'>): ActivityLogEntry {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO activity_log (id, project_id, task_id, action_type, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        entry.project_id,
        entry.task_id,
        entry.action_type,
        entry.details,
        timestamp
      )

      return {
        id,
        ...entry,
        created_at: timestamp
      }
    },

    getRecent(projectId?: string, limit: number = 20): ActivityLogEntry[] {
      if (projectId) {
        const stmt = getDb().prepare(`
          SELECT * FROM activity_log
          WHERE project_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `)
        return stmt.all(projectId, limit) as ActivityLogEntry[]
      } else {
        const stmt = getDb().prepare(`
          SELECT * FROM activity_log
          ORDER BY created_at DESC
          LIMIT ?
        `)
        return stmt.all(limit) as ActivityLogEntry[]
      }
    }
  },

  // Settings
  settings: {
    get(key: string): string | null {
      const stmt = getDb().prepare('SELECT value FROM settings WHERE key = ?')
      const result = stmt.get(key) as { value: string } | undefined
      return result?.value ?? null
    },

    set(key: string, value: string): void {
      const stmt = getDb().prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      stmt.run(key, value)
    },

    getAll(): Record<string, string> {
      const stmt = getDb().prepare('SELECT key, value FROM settings')
      const rows = stmt.all() as Array<{ key: string; value: string }>
      return Object.fromEntries(rows.map(r => [r.key, r.value]))
    }
  },

  // AI Conversations
  aiConversations: {
    save(conversation: Omit<AIConversation, 'id' | 'created_at'>): AIConversation {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO ai_conversations (id, project_id, task_id, user_message, ai_response, feedback, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        conversation.project_id,
        conversation.task_id,
        conversation.user_message,
        conversation.ai_response,
        conversation.feedback,
        timestamp
      )

      return {
        id,
        ...conversation,
        created_at: timestamp
      }
    },

    getByProject(projectId: string): AIConversation[] {
      const stmt = getDb().prepare(`
        SELECT * FROM ai_conversations
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(projectId) as AIConversation[]
    }
  },

  // Documents
  documents: {
    create(doc: { project_id: string | null; task_id: string | null; name: string; file_path: string; file_type: string; file_size: number }): Document {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO documents (id, project_id, task_id, name, file_path, file_type, file_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(id, doc.project_id, doc.task_id, doc.name, doc.file_path, doc.file_type, doc.file_size, timestamp)

      return {
        id,
        ...doc,
        created_at: timestamp
      }
    },

    getByTask(taskId: string): Document[] {
      const stmt = getDb().prepare(`
        SELECT * FROM documents
        WHERE task_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(taskId) as Document[]
    },

    getByProject(projectId: string): Document[] {
      const stmt = getDb().prepare(`
        SELECT * FROM documents
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(projectId) as Document[]
    },

    delete(id: string): void {
      const stmt = getDb().prepare('DELETE FROM documents WHERE id = ?')
      stmt.run(id)
    }
  }
}
