# Helm Implementation Plan — Phase 1: Scaffolding & Database

## Overview

Set up the Electron + React + TypeScript project structure and implement the SQLite database schema.

---

## Part 1: Project Scaffolding

### 1.1 Initialize Project

```bash
# Create project with Vite + React + TypeScript
pnpm create vite@latest . -- --template react-ts

# Install core dependencies
pnpm install
```

### 1.2 Install Dependencies

**Core:**
```bash
pnpm add electron better-sqlite3 zustand react-router-dom
pnpm add -D electron-vite @types/better-sqlite3
```

**UI:**
```bash
pnpm add -D tailwindcss postcss autoprefixer
pnpm add @headlessui/react lucide-react
```

**AI:**
```bash
pnpm add openai
```

### 1.3 Project Structure

```
helm/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # IPC bridge to renderer
│   └── database/
│       ├── schema.sql       # Database schema
│       ├── db.ts            # Database connection & queries
│       └── migrations/      # Future migrations
│
├── src/
│   ├── main.tsx             # React entry point
│   ├── App.tsx              # Root component + routing
│   │
│   ├── components/
│   │   └── ui/              # Reusable UI components (Button, Input, etc.)
│   │
│   ├── views/
│   │   ├── Home.tsx         # Daily summary
│   │   ├── Inbox.tsx        # Quick capture
│   │   ├── Project.tsx      # Project detail (List/Kanban)
│   │   ├── Focus.tsx        # Focus mode
│   │   └── Settings.tsx     # Settings
│   │
│   ├── store/
│   │   ├── projectStore.ts  # Zustand store for projects
│   │   ├── taskStore.ts     # Zustand store for tasks
│   │   └── uiStore.ts       # UI state (modals, active view, etc.)
│   │
│   ├── services/
│   │   ├── ai.ts            # OpenAI API calls
│   │   └── contextBuilder.ts # Build AI context from app state
│   │
│   ├── hooks/
│   │   ├── useProjects.ts
│   │   ├── useTasks.ts
│   │   └── useCopilot.ts
│   │
│   └── lib/
│       ├── utils.ts         # General utilities
│       └── prompts.ts       # AI system prompts
│
├── package.json
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── tsconfig.node.json
```

### 1.4 Electron Configuration

**electron/main.ts** — Main process setup:
- Create BrowserWindow
- Register global shortcuts (Cmd+K, Cmd+N, Cmd+Shift+F)
- Initialize SQLite database on app ready
- Handle IPC for database operations

**electron/preload.ts** — Expose safe APIs to renderer:
- `window.api.db.*` — Database operations
- `window.api.settings.*` — Read/write settings
- `window.api.ai.*` — OpenAI calls (API key stored securely)

### 1.5 Vite + Electron Integration

Use `electron-vite` for seamless dev experience:
- Hot reload for React
- Electron main process restart on change
- Single build command for distribution

---

## Part 2: Database Schema

### 2.1 Schema Design

**File:** `electron/database/schema.sql`

```sql
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
    details TEXT, -- JSON string
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_context ON projects(context);
```

### 2.2 Database Service

**File:** `electron/database/db.ts`

Implements:
- `initDatabase()` — Create tables on first run
- `runMigrations()` — Apply schema updates
- CRUD operations for each entity:
  - `projects.*` (create, getAll, getById, update, delete)
  - `tasks.*` (create, getByProject, getInbox, update, delete, reorder)
  - `activityLog.*` (log, getRecent)
  - `settings.*` (get, set)
  - `aiConversations.*` (save, getByProject)

### 2.3 IPC Handlers

**File:** `electron/main.ts` (IPC section)

Register handlers for renderer process:
```typescript
ipcMain.handle('db:projects:getAll', () => db.projects.getAll());
ipcMain.handle('db:projects:create', (_, project) => db.projects.create(project));
ipcMain.handle('db:tasks:getByProject', (_, projectId) => db.tasks.getByProject(projectId));
// ... etc
```

---

## Implementation Order

1. **Initialize Vite + React + TypeScript project**
2. **Add Electron with electron-vite**
3. **Configure Tailwind CSS**
4. **Set up project folder structure**
5. **Create SQLite schema file**
6. **Implement database service (db.ts)**
7. **Set up Electron main process with IPC**
8. **Create preload script with API bridge**
9. **Verify dev mode works (pnpm dev)**

---

## Files to Create

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `electron.vite.config.ts` | Vite + Electron config |
| `tailwind.config.js` | Tailwind setup |
| `tsconfig.json` | TypeScript config |
| `electron/main.ts` | Electron main process |
| `electron/preload.ts` | IPC bridge |
| `electron/database/schema.sql` | SQLite schema |
| `electron/database/db.ts` | Database operations |
| `src/main.tsx` | React entry |
| `src/App.tsx` | Root component |
| `src/index.css` | Tailwind imports |

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Package manager | **pnpm** |
| UUID generation | **crypto.randomUUID()** (native) |
| Notes table | **Include now** (schema ready for Phase 2) |

---

*Document created: January 2025*
