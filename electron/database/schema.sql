-- Helm Database Schema
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    why TEXT NOT NULL,
    done_definition TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'abandoned')),
    context TEXT NOT NULL DEFAULT 'personal'
        CHECK (context IN ('work', 'personal')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
);

-- Tasks table (supports subtasks via parent_task_id)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    parent_task_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT DEFAULT NULL
        CHECK (priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Notes table (Phase 2, but schema ready)
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    task_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Activity log for AI context
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    task_id TEXT,
    action_type TEXT NOT NULL
        CHECK (action_type IN ('created', 'updated', 'completed', 'viewed', 'commented')),
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- AI conversation history
CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    task_id TEXT,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    feedback TEXT CHECK (feedback IN ('helpful', 'not_helpful')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- User settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Documents/attachments
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    task_id TEXT,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    extracted_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Document chunks for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Note: document_embeddings virtual table is created in db.ts after loading sqlite-vec extension

-- Quick todos (standalone, project-independent)
CREATE TABLE IF NOT EXISTS quick_todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    list TEXT NOT NULL DEFAULT 'personal'
        CHECK (list IN ('personal', 'work', 'tweaks')),
    priority TEXT DEFAULT NULL
        CHECK (priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_context ON projects(context);
CREATE INDEX IF NOT EXISTS idx_documents_task ON documents(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_quick_todos_list ON quick_todos(list);
CREATE INDEX IF NOT EXISTS idx_quick_todos_due_date ON quick_todos(due_date);
CREATE INDEX IF NOT EXISTS idx_quick_todos_completed ON quick_todos(completed, completed_at);
