# Helm — Technical Stack

## Overview

Desktop application (Electron) with local-first data storage and cloud AI integration.

**Core principle:** The app manages all state and context. The AI is stateless — Helm injects relevant context on every API call.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ELECTRON                             │
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────────┐  │
│   │   React     │    │   Zustand   │    │   SQLite      │  │
│   │   Frontend  │◄──►│   Store     │◄──►│   Database    │  │
│   │             │    │             │    │               │  │
│   └─────────────┘    └─────────────┘    └───────────────┘  │
│                              │                              │
│                              ▼                              │
│                    ┌─────────────────┐                     │
│                    │  Context        │                     │
│                    │  Builder        │                     │
│                    └────────┬────────┘                     │
│                             │                              │
└─────────────────────────────┼──────────────────────────────┘
                              │
                              ▼ HTTPS
                    ┌─────────────────┐
                    │   OpenAI API    │
                    │   (GPT-5)       │
                    └─────────────────┘
```

---

## Frontend

| Technology | Purpose |
|------------|---------|
| **Electron** | Desktop shell, global shortcuts, system tray |
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **Zustand** | State management (lightweight, simple) |
| **React Router** | Navigation between views |

### Key views

- Inbox
- Project detail
- Focus mode (single next action)
- Kanban board
- Canvas (Phase 2)
- Settings

---

## Database

**SQLite** via `better-sqlite3`

Why SQLite:
- Zero setup, embedded in app
- Fast for single-user
- Easy to backup (single file)
- No Docker/server needed

### Data Model

```sql
-- Core entities
projects
├── id (uuid)
├── name
├── why (required - the purpose)
├── done_definition (required - what "done" looks like)
├── status (draft | active | paused | completed | abandoned)
├── context (work | personal)
├── created_at
├── updated_at
└── archived_at

tasks
├── id (uuid)
├── project_id (fk)
├── parent_task_id (fk, nullable - for subtasks)
├── title
├── description
├── status (todo | in_progress | done)
├── order (for sorting)
├── created_at
├── updated_at
└── completed_at

notes
├── id (uuid)
├── project_id (fk)
├── task_id (fk, nullable)
├── content (markdown)
├── created_at
└── updated_at

-- For AI context
activity_log
├── id (uuid)
├── project_id (fk)
├── task_id (fk, nullable)
├── action_type (created | updated | completed | commented | viewed)
├── details (json)
├── created_at

ai_conversations
├── id (uuid)
├── project_id (fk, nullable)
├── user_message
├── ai_response
├── feedback (helpful | not_helpful, nullable)
├── created_at

-- Phase 2
canvas
├── id (uuid)
├── project_id (fk)
├── name
├── data (json - nodes, edges, positions)
├── created_at
└── updated_at
```

---

## AI Integration

### Provider

**OpenAI API (GPT-5)** — or GPT-4.5 until GPT-5 releases

Why:
- Best reasoning capabilities
- Large context window (128k-200k+ tokens)
- Reliable API

### Context Injection Pattern

Every AI call includes dynamically built context:

```typescript
interface AIContext {
  // Current project (if any)
  project?: {
    name: string;
    why: string;
    doneDefinition: string;
    status: string;
    createdAt: Date;
    daysSinceCreation: number;
  };
  
  // Tasks
  tasks?: {
    completed: Task[];
    inProgress: Task[];
    todo: Task[];
    staleTasksCount: number; // tasks not touched in 7+ days
  };
  
  // Recent activity
  recentActivity?: ActivityLog[]; // last 20 actions
  
  // Temporal context
  temporal: {
    today: string;
    dayOfWeek: string;
    daysSinceLastActivity: number;
    currentTime: string;
  };
  
  // User patterns (long-term)
  patterns?: {
    averageProjectDuration: number;
    completionRate: number;
    commonAbandonmentPoint: string;
  };
}
```

### System Prompt

```
You are Helm, a project copilot for someone with ADHD.

Your personality:
- Direct, not corporate
- You challenge when the user drifts from their goal
- You remind them of their "Why" when they get lost in details
- You celebrate progress without being cheesy
- You're honest when something looks abandoned

Your job:
- Help break down vague ideas into concrete tasks
- Summarize where they are in a project
- Suggest the next logical action
- Detect when they're stuck or avoiding something
- Keep the "Done" definition in sight

Current context:
{dynamically injected}

Respond concisely. No fluff.
```

### API Call Structure

```typescript
async function askCopilot(userMessage: string, projectId?: string): Promise<string> {
  const context = await buildContext(projectId);
  
  const response = await openai.chat.completions.create({
    model: "gpt-5", // or gpt-4.5-turbo
    messages: [
      { role: "system", content: buildSystemPrompt(context) },
      { role: "user", content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 1000
  });
  
  // Log for future reference
  await logAIConversation(projectId, userMessage, response);
  
  return response.choices[0].message.content;
}
```

---

## What Makes the Copilot Feel "Real"

### 1. Rich Activity Logging

Log everything:
- Task created, updated, completed
- Project viewed (with duration)
- Focus mode entered/exited
- Notes added
- Questions asked to AI

This creates the "memory" that gets injected into prompts.

### 2. Temporal Awareness

Always include:
- Current date/time
- Days since project created
- Days since last activity
- Time tasks have been in "in progress"

### 3. Pattern Detection (Phase 2)

Over time, analyze:
- Average time from project creation to first task
- How long tasks stay "in progress" before completion or abandonment
- Common time of day for productivity
- Projects that stall at similar stages

### 4. Proactive Prompts

The app triggers AI without user asking:
- On daily open: "Here's where you left off"
- After 3 days inactivity on a project: "You haven't touched X in a while"
- When WIP limit exceeded: "You have 5 things in progress. Finish something?"

---

## Project Structure

```
helm/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Bridge to renderer
│   └── shortcuts.ts         # Global keyboard shortcuts
│
├── src/
│   ├── components/
│   │   ├── ui/              # Generic UI components
│   │   ├── TaskList/
│   │   ├── Kanban/
│   │   ├── ProjectCard/
│   │   └── Copilot/         # AI chat interface
│   │
│   ├── views/
│   │   ├── Inbox.tsx
│   │   ├── ProjectDetail.tsx
│   │   ├── FocusMode.tsx
│   │   ├── DailyPlanning.tsx
│   │   └── Settings.tsx
│   │
│   ├── services/
│   │   ├── database.ts      # SQLite operations
│   │   ├── ai.ts            # OpenAI API calls
│   │   ├── contextBuilder.ts # Builds AI context
│   │   └── activityLogger.ts
│   │
│   ├── store/
│   │   ├── projectStore.ts
│   │   ├── taskStore.ts
│   │   └── uiStore.ts
│   │
│   ├── hooks/
│   │   ├── useProjects.ts
│   │   ├── useTasks.ts
│   │   └── useCopilot.ts
│   │
│   └── utils/
│       ├── prompts.ts       # System prompts
│       └── temporal.ts      # Date/time helpers
│
├── database/
│   ├── schema.sql
│   └── migrations/
│
├── assets/
│   └── icons/
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── electron-builder.json
```

---

## Build & Distribution

| Tool | Purpose |
|------|---------|
| **Vite** | Fast bundling for React |
| **electron-builder** | Package for macOS (.dmg) |
| **electron-updater** | Auto-updates (optional) |

---

## Development Setup

```bash
# Prerequisites
node >= 20
npm or pnpm

# Install
pnpm install

# Dev mode
pnpm dev         # Starts Vite + Electron

# Build
pnpm build       # Creates distributable .dmg
```

---

## Security Considerations

- **API key storage**: Use Electron's safeStorage API (encrypted in keychain)
- **Database**: SQLite file stored in user's app data directory
- **No telemetry**: Zero data sent anywhere except OpenAI API calls
- **Local backups**: Optional export to JSON

---

## Open Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| GPT model | GPT-4.5-turbo vs wait for GPT-5 | Start with 4.5, switch when available |
| Canvas library | React Flow vs Excalidraw vs custom | React Flow (good balance) |
| Markdown editor | MDX Editor vs Milkdown vs custom | TBD based on needs |
| Global shortcut capture | Electron native vs robotjs | Electron native first |

---

*Document version: 1.0 — January 2025*