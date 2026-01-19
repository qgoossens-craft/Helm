import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { randomUUID } from 'crypto'
import * as sqliteVec from 'sqlite-vec'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let database: Database.Database | null = null

// Get database path
function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'helm.db')
}

// Get documents storage path
export function getDocumentsPath(): string {
  const userDataPath = app.getPath('userData')
  const documentsPath = join(userDataPath, 'documents')
  if (!existsSync(documentsPath)) {
    mkdirSync(documentsPath, { recursive: true })
  }
  return documentsPath
}

// Run migrations to update existing database schema
function runMigrations(db: Database.Database): void {
  // Migration: Add color and icon columns to projects table
  const projectsInfo = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>
  const projectColumns = projectsInfo.map(col => col.name)

  if (!projectColumns.includes('color')) {
    db.exec(`ALTER TABLE projects ADD COLUMN color TEXT DEFAULT 'orange'`)
    console.log('Migration: Added color column to projects')
  }

  if (!projectColumns.includes('icon')) {
    db.exec(`ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT 'folder'`)
    console.log('Migration: Added icon column to projects')
  }

  // Migration: Add deleted_at column to tasks table for soft delete
  const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>
  const taskColumns = tasksInfo.map(col => col.name)

  if (!taskColumns.includes('deleted_at')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN deleted_at TEXT DEFAULT NULL`)
    console.log('Migration: Added deleted_at column to tasks')
  }

  // Migration: Add priority column to tasks table
  if (!taskColumns.includes('priority')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT NULL CHECK (priority IN ('low', 'medium', 'high'))`)
    console.log('Migration: Added priority column to tasks')
  }

  // Migration: Add due_date column to tasks table
  if (!taskColumns.includes('due_date')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN due_date TEXT DEFAULT NULL`)
    console.log('Migration: Added due_date column to tasks')
  }

  // Migration: Add category column to tasks table
  if (!taskColumns.includes('category')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT NULL`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(project_id, category)`)
    console.log('Migration: Added category column to tasks')
  }

  // Check if documents table exists and needs migration
  const tableInfo = db.prepare("PRAGMA table_info(documents)").all() as Array<{ name: string }>
  const columnNames = tableInfo.map(col => col.name)

  // Add processing_status column if missing
  if (!columnNames.includes('processing_status')) {
    db.exec(`ALTER TABLE documents ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))`)
    console.log('Migration: Added processing_status column to documents')
  }

  // Add processing_error column if missing
  if (!columnNames.includes('processing_error')) {
    db.exec(`ALTER TABLE documents ADD COLUMN processing_error TEXT`)
    console.log('Migration: Added processing_error column to documents')
  }

  // Add extracted_text column if missing
  if (!columnNames.includes('extracted_text')) {
    db.exec(`ALTER TABLE documents ADD COLUMN extracted_text TEXT`)
    console.log('Migration: Added extracted_text column to documents')
  }

  // Create document_chunks table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `)

  // Create indexes if not exists
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id)`)

  // Migration: Update quick_todos table to support 'tweaks' list value
  // Check if the table needs migration by trying to insert a test value
  try {
    // Try to get the current table SQL to check if it has the old constraint
    const tableSQL = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='quick_todos'").get() as { sql: string } | undefined
    if (tableSQL && tableSQL.sql && !tableSQL.sql.includes("'tweaks'")) {
      console.log('Migration: Updating quick_todos table to support tweaks list...')

      // Recreate the table with the new constraint
      db.exec(`
        CREATE TABLE IF NOT EXISTS quick_todos_new (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          list TEXT NOT NULL DEFAULT 'personal'
              CHECK (list IN ('personal', 'work', 'tweaks')),
          due_date TEXT,
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      // Copy existing data
      db.exec(`
        INSERT INTO quick_todos_new (id, title, list, due_date, completed, completed_at, created_at, updated_at)
        SELECT id, title, list, due_date, completed, completed_at, created_at, updated_at FROM quick_todos
      `)

      // Drop old table and rename new one
      db.exec(`DROP TABLE quick_todos`)
      db.exec(`ALTER TABLE quick_todos_new RENAME TO quick_todos`)

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_quick_todos_list ON quick_todos(list)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_quick_todos_due_date ON quick_todos(due_date)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_quick_todos_completed ON quick_todos(completed, completed_at)`)

      console.log('Migration: quick_todos table updated to support tweaks list')
    }
  } catch {
    // Table might not exist yet, which is fine - it will be created with the new schema
    console.log('Migration: quick_todos table check skipped (table may not exist yet)')
  }

  // Migration: Add priority column to quick_todos table
  const quickTodosInfo = db.prepare("PRAGMA table_info(quick_todos)").all() as Array<{ name: string }>
  const quickTodosColumns = quickTodosInfo.map(col => col.name)

  if (!quickTodosColumns.includes('priority')) {
    db.exec(`ALTER TABLE quick_todos ADD COLUMN priority TEXT DEFAULT NULL CHECK (priority IN ('low', 'medium', 'high'))`)
    console.log('Migration: Added priority column to quick_todos')
  }

  // Migration: Add description column to quick_todos table
  if (!quickTodosColumns.includes('description')) {
    db.exec(`ALTER TABLE quick_todos ADD COLUMN description TEXT DEFAULT NULL`)
    console.log('Migration: Added description column to quick_todos')
  }

  // Migration: Add quick_todo_id column to documents table
  const documentsInfo = db.prepare("PRAGMA table_info(documents)").all() as Array<{ name: string }>
  const documentsColumns = documentsInfo.map(col => col.name)

  if (!documentsColumns.includes('quick_todo_id')) {
    db.exec(`ALTER TABLE documents ADD COLUMN quick_todo_id TEXT REFERENCES quick_todos(id) ON DELETE CASCADE`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_quick_todo ON documents(quick_todo_id)`)
    console.log('Migration: Added quick_todo_id column to documents')
  }

  // Migration: Create sources table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      task_id TEXT,
      quick_todo_id TEXT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      favicon_url TEXT,
      source_type TEXT NOT NULL DEFAULT 'link'
          CHECK (source_type IN ('link', 'article', 'video', 'document')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (quick_todo_id) REFERENCES quick_todos(id) ON DELETE CASCADE
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_task ON sources(task_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_quick_todo ON sources(quick_todo_id)`)

  // Migration: Add recurrence columns to tasks table
  const tasksInfoRecurrence = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>
  const taskColumnsRecurrence = tasksInfoRecurrence.map(col => col.name)

  if (!taskColumnsRecurrence.includes('recurrence_pattern')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_pattern TEXT DEFAULT NULL CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly'))`)
    console.log('Migration: Added recurrence_pattern column to tasks')
  }

  if (!taskColumnsRecurrence.includes('recurrence_config')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_config TEXT DEFAULT NULL`)
    console.log('Migration: Added recurrence_config column to tasks')
  }

  if (!taskColumnsRecurrence.includes('recurring_parent_id')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN recurring_parent_id TEXT DEFAULT NULL REFERENCES tasks(id) ON DELETE CASCADE`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_recurring_parent ON tasks(recurring_parent_id)`)
    console.log('Migration: Added recurring_parent_id column to tasks')
  }

  if (!taskColumnsRecurrence.includes('recurrence_end_date')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_end_date TEXT DEFAULT NULL`)
    console.log('Migration: Added recurrence_end_date column to tasks')
  }

  // Migration: Add recurrence columns to quick_todos table
  const quickTodosInfoRecurrence = db.prepare("PRAGMA table_info(quick_todos)").all() as Array<{ name: string }>
  const quickTodosColumnsRecurrence = quickTodosInfoRecurrence.map(col => col.name)

  if (!quickTodosColumnsRecurrence.includes('recurrence_pattern')) {
    db.exec(`ALTER TABLE quick_todos ADD COLUMN recurrence_pattern TEXT DEFAULT NULL CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly'))`)
    console.log('Migration: Added recurrence_pattern column to quick_todos')
  }

  if (!quickTodosColumnsRecurrence.includes('recurrence_config')) {
    db.exec(`ALTER TABLE quick_todos ADD COLUMN recurrence_config TEXT DEFAULT NULL`)
    console.log('Migration: Added recurrence_config column to quick_todos')
  }

  if (!quickTodosColumnsRecurrence.includes('recurring_parent_id')) {
    db.exec(`ALTER TABLE quick_todos ADD COLUMN recurring_parent_id TEXT DEFAULT NULL REFERENCES quick_todos(id) ON DELETE CASCADE`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_quick_todos_recurring_parent ON quick_todos(recurring_parent_id)`)
    console.log('Migration: Added recurring_parent_id column to quick_todos')
  }

  if (!quickTodosColumnsRecurrence.includes('recurrence_end_date')) {
    db.exec(`ALTER TABLE quick_todos ADD COLUMN recurrence_end_date TEXT DEFAULT NULL`)
    console.log('Migration: Added recurrence_end_date column to quick_todos')
  }
}

// Initialize database
export function initDatabase(): void {
  const dbPath = getDbPath()
  database = new Database(dbPath)

  // Load sqlite-vec extension for vector operations
  sqliteVec.load(database)

  // Enable foreign keys
  database.pragma('foreign_keys = ON')

  // Read and execute schema
  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')

  // Execute the entire schema at once
  try {
    database.exec(schema)
  } catch (error) {
    // Only log if it's not about existing tables or columns
    if (!String(error).includes('already exists') && !String(error).includes('duplicate column')) {
      console.error('Schema initialization error:', error)
    }
  }

  // Run migrations for existing databases
  runMigrations(database)

  // Create embeddings virtual table (requires sqlite-vec extension)
  try {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS document_embeddings USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[1536]
      )
    `)
  } catch (error) {
    if (!String(error).includes('already exists')) {
      console.error('Failed to create embeddings table:', error)
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
  color: string | null
  icon: string | null
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
  priority: 'low' | 'medium' | 'high' | null
  due_date: string | null
  category: string | null
  order: number
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
  // Recurrence fields
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  recurrence_config: string | null
  recurring_parent_id: string | null
  recurrence_end_date: string | null
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

interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  token_count: number
  created_at: string
}

interface SearchResult {
  chunk_id: string
  document_id: string
  document_name: string
  project_id: string | null
  task_id: string | null
  content: string
  distance: number
}

interface QuickTodo {
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
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  recurrence_config: string | null
  recurring_parent_id: string | null
  recurrence_end_date: string | null
}

interface Source {
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
        INSERT INTO projects (id, name, why, done_definition, status, context, color, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        project.name,
        project.why,
        project.done_definition,
        project.status || 'active',
        project.context || 'personal',
        project.color || 'orange',
        project.icon || 'folder',
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
      if (updates.color !== undefined) {
        fields.push('color = ?')
        values.push(updates.color)
      }
      if (updates.icon !== undefined) {
        fields.push('icon = ?')
        values.push(updates.icon)
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
          AND deleted_at IS NULL
        ORDER BY "order" ASC, created_at ASC
      `)
      return (projectId === null ? stmt.all() : stmt.all(projectId)) as Task[]
    },

    getInbox(): Task[] {
      const stmt = getDb().prepare(`
        SELECT * FROM tasks
        WHERE project_id IS NULL
          AND deleted_at IS NULL
        ORDER BY created_at DESC
      `)
      return stmt.all() as Task[]
    },

    getDeleted(projectId: string): Task[] {
      const stmt = getDb().prepare(`
        SELECT * FROM tasks
        WHERE project_id = ?
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
        LIMIT 10
      `)
      return stmt.all(projectId) as Task[]
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
        INSERT INTO tasks (id, project_id, parent_task_id, title, description, status, priority, "order", category, due_date, recurrence_pattern, recurrence_config, recurring_parent_id, recurrence_end_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        task.project_id,
        task.parent_task_id,
        task.title,
        task.description,
        task.status || 'todo',
        task.priority || null,
        order,
        task.category || null,
        task.due_date || null,
        task.recurrence_pattern || null,
        task.recurrence_config || null,
        task.recurring_parent_id || null,
        task.recurrence_end_date || null,
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
      if (updates.priority !== undefined) {
        fields.push('priority = ?')
        values.push(updates.priority)
      }
      if (updates.due_date !== undefined) {
        fields.push('due_date = ?')
        values.push(updates.due_date)
      }
      if (updates.category !== undefined) {
        fields.push('category = ?')
        values.push(updates.category)
      }
      if (updates.recurrence_pattern !== undefined) {
        fields.push('recurrence_pattern = ?')
        values.push(updates.recurrence_pattern)
      }
      if (updates.recurrence_config !== undefined) {
        fields.push('recurrence_config = ?')
        values.push(updates.recurrence_config)
      }
      if (updates.recurring_parent_id !== undefined) {
        fields.push('recurring_parent_id = ?')
        values.push(updates.recurring_parent_id)
      }
      if (updates.recurrence_end_date !== undefined) {
        fields.push('recurrence_end_date = ?')
        values.push(updates.recurrence_end_date)
      }

      fields.push('updated_at = ?')
      values.push(now())
      values.push(id)

      const stmt = getDb().prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`)
      stmt.run(...values)

      return this.getById(id)!
    },

    delete(id: string): void {
      // Soft delete - set deleted_at timestamp
      const stmt = getDb().prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?')
      stmt.run(now(), id)
    },

    restore(id: string): Task {
      const stmt = getDb().prepare('UPDATE tasks SET deleted_at = NULL WHERE id = ?')
      stmt.run(id)
      return this.getById(id)!
    },

    permanentDelete(id: string): void {
      const stmt = getDb().prepare('DELETE FROM tasks WHERE id = ?')
      stmt.run(id)
    },

    reorder(taskId: string, newOrder: number): void {
      const task = this.getById(taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)

      const updateStmt = getDb().prepare('UPDATE tasks SET "order" = ? WHERE id = ?')
      updateStmt.run(newOrder, taskId)
    },

    getCategoriesByProject(projectId: string): string[] {
      const stmt = getDb().prepare(`
        SELECT DISTINCT category FROM tasks
        WHERE project_id = ?
          AND category IS NOT NULL
          AND deleted_at IS NULL
        ORDER BY category ASC
      `)
      const rows = stmt.all(projectId) as Array<{ category: string }>
      return rows.map(r => r.category)
    },

    /**
     * Get all recurring parent tasks (tasks with recurrence_pattern set and no recurring_parent_id)
     */
    getRecurring(projectId?: string): Task[] {
      if (projectId) {
        const stmt = getDb().prepare(`
          SELECT * FROM tasks
          WHERE recurrence_pattern IS NOT NULL
            AND recurring_parent_id IS NULL
            AND project_id = ?
            AND deleted_at IS NULL
          ORDER BY due_date ASC
        `)
        return stmt.all(projectId) as Task[]
      }

      const stmt = getDb().prepare(`
        SELECT * FROM tasks
        WHERE recurrence_pattern IS NOT NULL
          AND recurring_parent_id IS NULL
          AND deleted_at IS NULL
        ORDER BY due_date ASC
      `)
      return stmt.all() as Task[]
    },

    /**
     * Get instances of a recurring task (materialized occurrences)
     */
    getInstances(parentId: string): Task[] {
      const stmt = getDb().prepare(`
        SELECT * FROM tasks
        WHERE recurring_parent_id = ?
          AND deleted_at IS NULL
        ORDER BY due_date ASC
      `)
      return stmt.all(parentId) as Task[]
    },

    /**
     * Create a materialized instance of a recurring task for a specific date
     */
    createInstance(parentTask: Task, dueDate: string): Task {
      const id = generateId()
      const timestamp = now()

      // Get next order number
      const orderStmt = getDb().prepare(`
        SELECT COALESCE(MAX("order"), -1) + 1 as next_order
        FROM tasks
        WHERE project_id ${parentTask.project_id === null ? 'IS NULL' : '= ?'}
      `)
      const orderResult = parentTask.project_id === null
        ? orderStmt.get() as { next_order: number }
        : orderStmt.get(parentTask.project_id) as { next_order: number }

      const stmt = getDb().prepare(`
        INSERT INTO tasks (id, project_id, parent_task_id, title, description, status, priority, "order", category, due_date, recurring_parent_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        parentTask.project_id,
        parentTask.parent_task_id,
        parentTask.title,
        parentTask.description,
        'todo',
        parentTask.priority,
        orderResult.next_order,
        parentTask.category,
        dueDate,
        parentTask.id,
        timestamp,
        timestamp
      )

      return this.getById(id)!
    },

    /**
     * Check if an instance exists for a recurring task on a specific date
     */
    hasInstanceOnDate(parentId: string, dueDate: string): boolean {
      const stmt = getDb().prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE recurring_parent_id = ?
          AND due_date = ?
          AND deleted_at IS NULL
      `)
      const result = stmt.get(parentId, dueDate) as { count: number }
      return result.count > 0
    },

    /**
     * Get tasks due on a specific date (including virtual recurring occurrences)
     */
    getDueOnDate(date: string): Task[] {
      const stmt = getDb().prepare(`
        SELECT * FROM tasks
        WHERE due_date = ?
          AND deleted_at IS NULL
        ORDER BY "order" ASC
      `)
      return stmt.all(date) as Task[]
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
    },

    getRecent(projectId?: string, limit: number = 5): AIConversation[] {
      if (projectId) {
        const stmt = getDb().prepare(`
          SELECT * FROM ai_conversations
          WHERE project_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `)
        return stmt.all(projectId, limit) as AIConversation[]
      } else {
        const stmt = getDb().prepare(`
          SELECT * FROM ai_conversations
          ORDER BY created_at DESC
          LIMIT ?
        `)
        return stmt.all(limit) as AIConversation[]
      }
    }
  },

  // Documents
  documents: {
    create(doc: { project_id: string | null; task_id: string | null; quick_todo_id?: string | null; name: string; file_path: string; file_type: string; file_size: number }): Document {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO documents (id, project_id, task_id, quick_todo_id, name, file_path, file_type, file_size, processing_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `)

      stmt.run(id, doc.project_id, doc.task_id, doc.quick_todo_id || null, doc.name, doc.file_path, doc.file_type, doc.file_size, timestamp)

      return this.getById(id)!
    },

    getById(id: string): Document | null {
      const stmt = getDb().prepare('SELECT * FROM documents WHERE id = ?')
      return (stmt.get(id) as Document) || null
    },

    getByTask(taskId: string): Document[] {
      const stmt = getDb().prepare(`
        SELECT * FROM documents
        WHERE task_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(taskId) as Document[]
    },

    getByQuickTodo(quickTodoId: string): Document[] {
      const stmt = getDb().prepare(`
        SELECT * FROM documents
        WHERE quick_todo_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(quickTodoId) as Document[]
    },

    getByProject(projectId: string): Document[] {
      const stmt = getDb().prepare(`
        SELECT * FROM documents
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(projectId) as Document[]
    },

    updateStatus(id: string, status: Document['processing_status'], error?: string, extractedText?: string): void {
      const stmt = getDb().prepare(`
        UPDATE documents
        SET processing_status = ?, processing_error = ?, extracted_text = ?
        WHERE id = ?
      `)
      stmt.run(status, error || null, extractedText || null, id)
    },

    updateName(id: string, name: string): void {
      const stmt = getDb().prepare('UPDATE documents SET name = ? WHERE id = ?')
      stmt.run(name, id)
    },

    delete(id: string): void {
      const stmt = getDb().prepare('DELETE FROM documents WHERE id = ?')
      stmt.run(id)
    }
  },

  // Document Chunks
  chunks: {
    create(chunk: Omit<DocumentChunk, 'id' | 'created_at'>): DocumentChunk {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO document_chunks (id, document_id, chunk_index, content, token_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      stmt.run(id, chunk.document_id, chunk.chunk_index, chunk.content, chunk.token_count, timestamp)

      return { id, ...chunk, created_at: timestamp }
    },

    getByDocument(documentId: string): DocumentChunk[] {
      const stmt = getDb().prepare(`
        SELECT * FROM document_chunks
        WHERE document_id = ?
        ORDER BY chunk_index ASC
      `)
      return stmt.all(documentId) as DocumentChunk[]
    },

    deleteByDocument(documentId: string): void {
      const stmt = getDb().prepare('DELETE FROM document_chunks WHERE document_id = ?')
      stmt.run(documentId)
    }
  },

  // Document Embeddings
  embeddings: {
    store(chunkId: string, embedding: Float32Array): void {
      const stmt = getDb().prepare(`
        INSERT INTO document_embeddings (chunk_id, embedding)
        VALUES (?, ?)
      `)
      stmt.run(chunkId, embedding)
    },

    deleteByChunk(chunkId: string): void {
      const stmt = getDb().prepare('DELETE FROM document_embeddings WHERE chunk_id = ?')
      stmt.run(chunkId)
    },

    searchSimilar(queryEmbedding: Float32Array, limit: number = 5, projectId?: string, taskId?: string): SearchResult[] {
      let query = `
        SELECT
          dc.id as chunk_id,
          dc.document_id,
          d.name as document_name,
          d.project_id,
          d.task_id,
          dc.content,
          vec_distance_L2(de.embedding, ?) as distance
        FROM document_embeddings de
        JOIN document_chunks dc ON dc.id = de.chunk_id
        JOIN documents d ON d.id = dc.document_id
        WHERE d.processing_status = 'completed'
      `

      const params: (Float32Array | string | number)[] = [queryEmbedding]

      if (projectId) {
        query += ' AND d.project_id = ?'
        params.push(projectId)
      }
      if (taskId) {
        query += ' AND d.task_id = ?'
        params.push(taskId)
      }

      query += ' ORDER BY distance ASC LIMIT ?'
      params.push(limit)

      const stmt = getDb().prepare(query)
      return stmt.all(...params) as SearchResult[]
    }
  },

  // Quick Todos
  quickTodos: {
    getAll(list?: 'personal' | 'work' | 'tweaks'): QuickTodo[] {
      // Filter out completed items older than 24 hours
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      if (list) {
        const stmt = getDb().prepare(`
          SELECT * FROM quick_todos
          WHERE list = ?
            AND (completed = 0 OR completed_at > ?)
          ORDER BY completed ASC, created_at DESC
        `)
        return stmt.all(list, cutoff).map(this._mapRow) as QuickTodo[]
      }

      const stmt = getDb().prepare(`
        SELECT * FROM quick_todos
        WHERE completed = 0 OR completed_at > ?
        ORDER BY completed ASC, created_at DESC
      `)
      return stmt.all(cutoff).map(this._mapRow) as QuickTodo[]
    },

    getById(id: string): QuickTodo | null {
      const stmt = getDb().prepare('SELECT * FROM quick_todos WHERE id = ?')
      const row = stmt.get(id)
      return row ? this._mapRow(row) : null
    },

    getDueToday(): QuickTodo[] {
      const today = new Date().toISOString().split('T')[0]
      const stmt = getDb().prepare(`
        SELECT * FROM quick_todos
        WHERE due_date = ? AND completed = 0
        ORDER BY created_at ASC
      `)
      return stmt.all(today).map(this._mapRow) as QuickTodo[]
    },

    getOverdue(): QuickTodo[] {
      const today = new Date().toISOString().split('T')[0]
      const stmt = getDb().prepare(`
        SELECT * FROM quick_todos
        WHERE due_date < ? AND completed = 0
        ORDER BY due_date ASC
      `)
      return stmt.all(today).map(this._mapRow) as QuickTodo[]
    },

    create(todo: { title: string; list: 'personal' | 'work' | 'tweaks'; description?: string | null; priority?: 'low' | 'medium' | 'high' | null; due_date?: string | null; recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null; recurrence_config?: string | null; recurring_parent_id?: string | null; recurrence_end_date?: string | null }): QuickTodo {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO quick_todos (id, title, description, list, priority, due_date, recurrence_pattern, recurrence_config, recurring_parent_id, recurrence_end_date, completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `)

      stmt.run(
        id,
        todo.title,
        todo.description || null,
        todo.list,
        todo.priority || null,
        todo.due_date || null,
        todo.recurrence_pattern || null,
        todo.recurrence_config || null,
        todo.recurring_parent_id || null,
        todo.recurrence_end_date || null,
        timestamp,
        timestamp
      )

      return this.getById(id)!
    },

    update(id: string, updates: Partial<{ title: string; description: string | null; list: 'personal' | 'work' | 'tweaks'; priority: 'low' | 'medium' | 'high' | null; due_date: string | null; completed: boolean; recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null; recurrence_config: string | null; recurrence_end_date: string | null }>): QuickTodo {
      const current = this.getById(id)
      if (!current) throw new Error(`QuickTodo ${id} not found`)

      const fields: string[] = []
      const values: (string | number | null)[] = []

      if (updates.title !== undefined) {
        fields.push('title = ?')
        values.push(updates.title)
      }
      if (updates.description !== undefined) {
        fields.push('description = ?')
        values.push(updates.description)
      }
      if (updates.list !== undefined) {
        fields.push('list = ?')
        values.push(updates.list)
      }
      if (updates.priority !== undefined) {
        fields.push('priority = ?')
        values.push(updates.priority)
      }
      if (updates.due_date !== undefined) {
        fields.push('due_date = ?')
        values.push(updates.due_date)
      }
      if (updates.completed !== undefined) {
        fields.push('completed = ?')
        values.push(updates.completed ? 1 : 0)

        // Set completed_at when marking complete
        if (updates.completed && !current.completed) {
          fields.push('completed_at = ?')
          values.push(now())
        } else if (!updates.completed && current.completed) {
          fields.push('completed_at = ?')
          values.push(null)
        }
      }
      if (updates.recurrence_pattern !== undefined) {
        fields.push('recurrence_pattern = ?')
        values.push(updates.recurrence_pattern)
      }
      if (updates.recurrence_config !== undefined) {
        fields.push('recurrence_config = ?')
        values.push(updates.recurrence_config)
      }
      if (updates.recurrence_end_date !== undefined) {
        fields.push('recurrence_end_date = ?')
        values.push(updates.recurrence_end_date)
      }

      fields.push('updated_at = ?')
      values.push(now())
      values.push(id)

      const stmt = getDb().prepare(`UPDATE quick_todos SET ${fields.join(', ')} WHERE id = ?`)
      stmt.run(...values)

      return this.getById(id)!
    },

    delete(id: string): void {
      const stmt = getDb().prepare('DELETE FROM quick_todos WHERE id = ?')
      stmt.run(id)
    },

    /**
     * Get all recurring parent todos (todos with recurrence_pattern set and no recurring_parent_id)
     */
    getRecurring(list?: 'personal' | 'work' | 'tweaks'): QuickTodo[] {
      if (list) {
        const stmt = getDb().prepare(`
          SELECT * FROM quick_todos
          WHERE recurrence_pattern IS NOT NULL
            AND recurring_parent_id IS NULL
            AND list = ?
          ORDER BY due_date ASC
        `)
        return stmt.all(list).map(this._mapRow) as QuickTodo[]
      }

      const stmt = getDb().prepare(`
        SELECT * FROM quick_todos
        WHERE recurrence_pattern IS NOT NULL
          AND recurring_parent_id IS NULL
        ORDER BY due_date ASC
      `)
      return stmt.all().map(this._mapRow) as QuickTodo[]
    },

    /**
     * Get instances of a recurring todo (materialized occurrences)
     */
    getInstances(parentId: string): QuickTodo[] {
      const stmt = getDb().prepare(`
        SELECT * FROM quick_todos
        WHERE recurring_parent_id = ?
        ORDER BY due_date ASC
      `)
      return stmt.all(parentId).map(this._mapRow) as QuickTodo[]
    },

    /**
     * Create a materialized instance of a recurring todo for a specific date
     */
    createInstance(parentTodo: QuickTodo, dueDate: string): QuickTodo {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO quick_todos (id, title, description, list, priority, due_date, recurring_parent_id, completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `)

      stmt.run(
        id,
        parentTodo.title,
        parentTodo.description,
        parentTodo.list,
        parentTodo.priority,
        dueDate,
        parentTodo.id,
        timestamp,
        timestamp
      )

      return this.getById(id)!
    },

    /**
     * Check if an instance exists for a recurring todo on a specific date
     */
    hasInstanceOnDate(parentId: string, dueDate: string): boolean {
      const stmt = getDb().prepare(`
        SELECT COUNT(*) as count FROM quick_todos
        WHERE recurring_parent_id = ?
          AND due_date = ?
      `)
      const result = stmt.get(parentId, dueDate) as { count: number }
      return result.count > 0
    },

    /**
     * Get todos due on a specific date
     */
    getDueOnDate(date: string): QuickTodo[] {
      const stmt = getDb().prepare(`
        SELECT * FROM quick_todos
        WHERE due_date = ?
          AND completed = 0
        ORDER BY created_at ASC
      `)
      return stmt.all(date).map(this._mapRow) as QuickTodo[]
    },

    // Helper to convert SQLite row to QuickTodo (boolean conversion)
    _mapRow(row: unknown): QuickTodo {
      const r = row as Record<string, unknown>
      return {
        ...r,
        completed: r.completed === 1
      } as QuickTodo
    }
  },

  // Sources (URL links)
  sources: {
    create(source: Omit<Source, 'id' | 'created_at'>): Source {
      const id = generateId()
      const timestamp = now()

      const stmt = getDb().prepare(`
        INSERT INTO sources (id, project_id, task_id, quick_todo_id, url, title, description, favicon_url, source_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        source.project_id,
        source.task_id,
        source.quick_todo_id,
        source.url,
        source.title,
        source.description,
        source.favicon_url,
        source.source_type || 'link',
        timestamp
      )

      return this.getById(id)!
    },

    getById(id: string): Source | null {
      const stmt = getDb().prepare('SELECT * FROM sources WHERE id = ?')
      return (stmt.get(id) as Source) || null
    },

    getByTask(taskId: string): Source[] {
      const stmt = getDb().prepare(`
        SELECT * FROM sources
        WHERE task_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(taskId) as Source[]
    },

    getByQuickTodo(quickTodoId: string): Source[] {
      const stmt = getDb().prepare(`
        SELECT * FROM sources
        WHERE quick_todo_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(quickTodoId) as Source[]
    },

    getByProject(projectId: string): Source[] {
      const stmt = getDb().prepare(`
        SELECT * FROM sources
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)
      return stmt.all(projectId) as Source[]
    },

    update(id: string, updates: Partial<Pick<Source, 'title' | 'description' | 'favicon_url' | 'source_type'>>): Source {
      const current = this.getById(id)
      if (!current) throw new Error(`Source ${id} not found`)

      const fields: string[] = []
      const values: (string | null)[] = []

      if (updates.title !== undefined) {
        fields.push('title = ?')
        values.push(updates.title)
      }
      if (updates.description !== undefined) {
        fields.push('description = ?')
        values.push(updates.description)
      }
      if (updates.favicon_url !== undefined) {
        fields.push('favicon_url = ?')
        values.push(updates.favicon_url)
      }
      if (updates.source_type !== undefined) {
        fields.push('source_type = ?')
        values.push(updates.source_type)
      }

      if (fields.length === 0) return current

      values.push(id)
      const stmt = getDb().prepare(`UPDATE sources SET ${fields.join(', ')} WHERE id = ?`)
      stmt.run(...values)

      return this.getById(id)!
    },

    delete(id: string): void {
      const stmt = getDb().prepare('DELETE FROM sources WHERE id = ?')
      stmt.run(id)
    }
  },

  // Stats queries
  stats: {
    getCompletionStats(): CompletionStats {
      const database = getDb()

      // Get today's date boundaries
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()
      const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()

      // Get week boundaries (Monday start)
      const weekStart = new Date(today)
      const dayOfWeek = weekStart.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Monday
      weekStart.setDate(weekStart.getDate() + diff)
      const weekStartStr = weekStart.toISOString()

      // Get month boundaries
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthStartStr = monthStart.toISOString()

      // Tasks completed today
      const tasksToday = database.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE status = 'done'
        AND completed_at >= ? AND completed_at < ?
        AND deleted_at IS NULL
      `).get(todayStr, tomorrowStr) as { count: number }

      // Tasks completed this week
      const tasksWeek = database.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE status = 'done'
        AND completed_at >= ?
        AND deleted_at IS NULL
      `).get(weekStartStr) as { count: number }

      // Tasks completed this month
      const tasksMonth = database.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE status = 'done'
        AND completed_at >= ?
        AND deleted_at IS NULL
      `).get(monthStartStr) as { count: number }

      // Total tasks completed all time
      const tasksAllTime = database.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE status = 'done'
        AND deleted_at IS NULL
      `).get() as { count: number }

      // Quick todos completed today
      const todosToday = database.prepare(`
        SELECT COUNT(*) as count FROM quick_todos
        WHERE completed = 1
        AND completed_at >= ? AND completed_at < ?
      `).get(todayStr, tomorrowStr) as { count: number }

      // Quick todos completed this week
      const todosWeek = database.prepare(`
        SELECT COUNT(*) as count FROM quick_todos
        WHERE completed = 1
        AND completed_at >= ?
      `).get(weekStartStr) as { count: number }

      // Quick todos completed this month
      const todosMonth = database.prepare(`
        SELECT COUNT(*) as count FROM quick_todos
        WHERE completed = 1
        AND completed_at >= ?
      `).get(monthStartStr) as { count: number }

      // Total todos completed all time
      const todosAllTime = database.prepare(`
        SELECT COUNT(*) as count FROM quick_todos
        WHERE completed = 1
      `).get() as { count: number }

      // Breakdown by todo list (all time)
      const todosByList = database.prepare(`
        SELECT list, COUNT(*) as count FROM quick_todos
        WHERE completed = 1
        GROUP BY list
      `).all() as Array<{ list: string; count: number }>

      // Projects completed
      const projectsCompleted = database.prepare(`
        SELECT COUNT(*) as count FROM projects
        WHERE status = 'completed'
      `).get() as { count: number }

      // Current streak calculation
      const streak = this._calculateStreak(database)

      // Best day calculation
      const bestDay = this._getBestDay(database)

      // Weekly trend (last 7 days)
      const weeklyTrend = this._getWeeklyTrend(database)

      return {
        tasks: {
          today: tasksToday.count,
          week: tasksWeek.count,
          month: tasksMonth.count,
          allTime: tasksAllTime.count
        },
        todos: {
          today: todosToday.count,
          week: todosWeek.count,
          month: todosMonth.count,
          allTime: todosAllTime.count,
          byList: {
            personal: todosByList.find(t => t.list === 'personal')?.count || 0,
            work: todosByList.find(t => t.list === 'work')?.count || 0,
            tweaks: todosByList.find(t => t.list === 'tweaks')?.count || 0
          }
        },
        projects: {
          completed: projectsCompleted.count
        },
        streak: {
          current: streak.current,
          longest: streak.longest
        },
        bestDay: bestDay,
        weeklyTrend: weeklyTrend
      }
    },

    _calculateStreak(database: ReturnType<typeof getDb>): { current: number; longest: number } {
      // Get all days with completions (tasks or todos)
      const completionDays = database.prepare(`
        SELECT DISTINCT DATE(completed_at) as day FROM (
          SELECT completed_at FROM tasks WHERE status = 'done' AND completed_at IS NOT NULL AND deleted_at IS NULL
          UNION ALL
          SELECT completed_at FROM quick_todos WHERE completed = 1 AND completed_at IS NOT NULL
        )
        ORDER BY day DESC
      `).all() as Array<{ day: string }>

      if (completionDays.length === 0) return { current: 0, longest: 0 }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      let currentStreak = 0
      let longestStreak = 0
      let tempStreak = 0
      let prevDay: Date | null = null

      // Check if streak is active (completed today or yesterday)
      const firstDay = completionDays[0].day
      const streakActive = firstDay === todayStr || firstDay === yesterdayStr

      for (const { day } of completionDays) {
        const currentDay = new Date(day)

        if (prevDay === null) {
          tempStreak = 1
        } else {
          const diffDays = Math.round((prevDay.getTime() - currentDay.getTime()) / (24 * 60 * 60 * 1000))
          if (diffDays === 1) {
            tempStreak++
          } else {
            longestStreak = Math.max(longestStreak, tempStreak)
            tempStreak = 1
          }
        }
        prevDay = currentDay
      }
      longestStreak = Math.max(longestStreak, tempStreak)

      // Current streak only counts if active
      if (streakActive) {
        currentStreak = 0
        prevDay = null
        for (const { day } of completionDays) {
          const currentDay = new Date(day)
          if (prevDay === null) {
            currentStreak = 1
          } else {
            const diffDays = Math.round((prevDay.getTime() - currentDay.getTime()) / (24 * 60 * 60 * 1000))
            if (diffDays === 1) {
              currentStreak++
            } else {
              break
            }
          }
          prevDay = currentDay
        }
      }

      return { current: currentStreak, longest: longestStreak }
    },

    _getBestDay(database: ReturnType<typeof getDb>): { date: string; count: number } {
      const best = database.prepare(`
        SELECT day, SUM(count) as total FROM (
          SELECT DATE(completed_at) as day, COUNT(*) as count
          FROM tasks
          WHERE status = 'done' AND completed_at IS NOT NULL AND deleted_at IS NULL
          GROUP BY DATE(completed_at)
          UNION ALL
          SELECT DATE(completed_at) as day, COUNT(*) as count
          FROM quick_todos
          WHERE completed = 1 AND completed_at IS NOT NULL
          GROUP BY DATE(completed_at)
        )
        GROUP BY day
        ORDER BY total DESC
        LIMIT 1
      `).get() as { day: string; total: number } | undefined

      return best ? { date: best.day, count: best.total } : { date: '', count: 0 }
    },

    _getWeeklyTrend(database: ReturnType<typeof getDb>): Array<{ day: string; tasks: number; todos: number }> {
      // Get task completions grouped by date for the last 7 days
      const tasksByDay = database.prepare(`
        SELECT DATE(completed_at, 'localtime') as day, COUNT(*) as count
        FROM tasks
        WHERE status = 'done'
        AND completed_at >= datetime('now', '-7 days')
        AND deleted_at IS NULL
        GROUP BY DATE(completed_at, 'localtime')
      `).all() as Array<{ day: string; count: number }>

      // Get todo completions grouped by date for the last 7 days
      const todosByDay = database.prepare(`
        SELECT DATE(completed_at, 'localtime') as day, COUNT(*) as count
        FROM quick_todos
        WHERE completed = 1
        AND completed_at >= datetime('now', '-7 days')
        GROUP BY DATE(completed_at, 'localtime')
      `).all() as Array<{ day: string; count: number }>

      // Create lookup maps
      const tasksMap = new Map(tasksByDay.map(r => [r.day, r.count]))
      const todosMap = new Map(todosByDay.map(r => [r.day, r.count]))

      // Build result for the last 7 days
      const result: Array<{ day: string; tasks: number; todos: number }> = []
      const now = new Date()

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        // Format as YYYY-MM-DD in local timezone
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

        result.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          tasks: tasksMap.get(dateStr) || 0,
          todos: todosMap.get(dateStr) || 0
        })
      }

      return result
    }
  }
}
