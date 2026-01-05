# Helm — MVP Specification

## Overview

This document describes the exact screens, flows, and behaviors for Helm's MVP. It's meant to be used as a reference for implementation.

**Scope:** Personal project management app with AI copilot, desktop only (Electron), single user.

---

## Navigation Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [≡]  [Home] [Inbox] [Projects ▼] [Focus]           [⌘K] [⚙]   │
└─────────────────────────────────────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| `[≡]` | Hamburger menu (mobile-style, optional for MVP) |
| `[Home]` | Daily summary view — default on app open |
| `[Inbox]` | Quick capture, unsorted items |
| `[Projects ▼]` | Dropdown list of all projects |
| `[Focus]` | Single next action view |
| `[⌘K]` | Global AI copilot shortcut (also works via keyboard) |
| `[⚙]` | Settings |

---

## Screens

### 1. Home (Daily Summary)

**When:** Default screen when opening the app.

**Purpose:** Give immediate context. Answer "where was I?" without thinking.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Good morning, Quentin.                                         │
│                                                                 │
│  Here's where you left off:                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔴 QA Strategy — stuck for 3 days                       │   │
│  │    Context: Work                                        │   │
│  │    Last action: "Create powerpoint" marked in progress  │   │
│  │    → Suggested: Break down the powerpoint task          │   │
│  │                                        [Open Project]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟢 Helm Development — on track                          │   │
│  │    Context: Personal                                    │   │
│  │    3 tasks completed yesterday                          │   │
│  │    → Next: Set up Electron boilerplate                  │   │
│  │                                        [Open Project]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📥 Inbox: 2 items waiting to be sorted                  │   │
│  │                                        [Open Inbox]     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                                                 │
│  [Enter Focus Mode]                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**AI-generated content:**
- Greeting with time awareness ("Good morning" / "Good evening")
- Project status indicators (🔴 stuck, 🟡 slow, 🟢 on track)
- "Stuck for X days" based on activity_log
- Last action from activity_log
- Suggested next step (AI-generated based on project state)

**Status logic:**
- 🔴 Stuck: No activity for 3+ days on an active project
- 🟡 Slow: No activity for 1-2 days
- 🟢 On track: Activity within last 24h

**Actions:**
- Click project card → Opens project view
- Click "Open Inbox" → Opens inbox
- Click "Enter Focus Mode" → Opens focus view

---

### 2. Inbox

**Purpose:** Capture ideas fast. Sort later.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Inbox                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ + Add item... (Cmd+N)                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ Research competitor pricing                           │   │
│  │   Added 2 hours ago                     [→ Move] [🗑]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ Call mom about birthday                               │   │
│  │   Added yesterday                       [→ Move] [🗑]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- `Cmd+N` or click input → Focus on input, type, press Enter to add
- Items have no project assigned yet
- `[→ Move]` → Dropdown to select project (or create new)
- `[🗑]` → Delete item
- Items sorted by creation date (newest first)

**Data model:**
- Inbox items are tasks with `project_id = null`

---

### 3. Project View

**Purpose:** See and manage all tasks for a single project.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  [Projects ▼] QA Strategy                                       │
├─────────────────────────────────────────────────────────────────┤
│  [List] [Kanban]                                                │
├─────────────────────────────────────┬───────────────────────────┤
│                                     │                           │
│  + Add task...                      │   ┌─────────────────────┐ │
│                                     │   │ WHY                 │ │
│  ○ Review the Sales technique for   │   │ Clarify our QA      │ │
│    man/days projects                │   │ offering and process│ │
│                                     │   ├─────────────────────┤ │
│  ○ Create a powerpoint of the ←selected│ │ DONE IS            │ │
│    QA Strategy                      │   │ Presentation ready  │ │
│    └─ Subtask 1                     │   │ for client meetings │ │
│    └─ Subtask 2                     │   ├─────────────────────┤ │
│                                     │   │ COPILOT             │ │
│  ○ Review the Sales Part with       │   │                     │ │
│    clean intent                     │   │ You've been on this │ │
│                                     │   │ task for 2 days.    │ │
│  ○ Review the process tree          │   │ Want me to help     │ │
│                                     │   │ break it down?      │ │
│                                     │   │                     │ │
│                                     │   │ [Yes] [Not now]     │ │
│                                     │   └─────────────────────┘ │
│                                     │                           │
└─────────────────────────────────────┴───────────────────────────┘
```

**Left panel (task list or kanban):**

*List view:*
- Tasks displayed as flat list with indented subtasks
- Click task → Select it, show details in right panel
- Drag to reorder
- Click checkbox → Mark complete
- `+ Add task...` at top, always visible

*Kanban view:*
- Three columns: To-do | In progress | Completed
- Drag cards between columns
- Click card → Show details in right panel

**Right panel (contextual):**

*When a task is selected:*
- Task title (editable)
- Description (markdown, editable)
- Subtasks list
- Created date
- Action buttons: Delete, Convert to project

*When no task is selected:*
- Project "Why" (always visible reminder)
- Project "Done" definition
- Copilot context: proactive suggestions based on project state

**Tab switching:**
- `[List]` / `[Kanban]` tabs at top
- Remembers last used view per project

---

### 4. Focus Mode

**Purpose:** Show ONE thing. The next action. Nothing else.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                    QA Strategy                                  │
│                    ───────────                                  │
│                                                                 │
│                    Create a powerpoint of                       │
│                    the QA Strategy                              │
│                                                                 │
│                                                                 │
│                    Why this matters:                            │
│                    "Clarify our QA offering"                    │
│                                                                 │
│                                                                 │
│            [✓ Done]  [Skip for now]  [Break it down]            │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Content:**
- Project name (small)
- Current task (large, centered)
- Why reminder (the project's "Why")

**Actions:**
- `[✓ Done]` → Mark task complete, show next task (or "You're all caught up!")
- `[Skip for now]` → Move to next task, keep this one in queue
- `[Break it down]` → Open copilot to help decompose the task

**Task selection logic:**
- Picks the first "In progress" task
- If none, picks the first "To-do" task
- Prioritizes tasks from projects with recent activity
- Respects context filter if set (Work only / Personal only)

---

### 5. Project Kickoff Wizard

**When:** User clicks "+ New Project"

**Purpose:** Guide project creation with AI assistance. Force clarity before starting.

**Flow:**

```
STEP 1 — Brain dump
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  What's on your mind?                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │ I need to create a QA strategy presentation for my      │   │
│  │ company. We need to clarify what we offer, our process  │   │
│  │ for different project types, pricing tiers...           │   │
│  │                                                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Just dump your thoughts. I'll help you structure it.          │
│                                                                 │
│                                          [Continue →]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```
STEP 2 — AI structures it
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Here's what I understood:                                      │
│                                                                 │
│  Project name                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ QA Strategy Presentation                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Why are you doing this?                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Clarify and document Craft-IT's QA offering so the      │   │
│  │ team can present it consistently to clients.            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  What does "done" look like?                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ A PowerPoint presentation ready to be used in client    │   │
│  │ meetings, covering services, process, and pricing.      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Context: [Work ▼]                                              │
│                                                                 │
│  You can edit any of these.                                     │
│                                                                 │
│                               [← Back]  [Looks good →]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```
STEP 3 — Initial breakdown
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Let's break it down into first steps:                          │
│                                                                 │
│  ☑ Review the Sales technique for man/days projects             │
│  ☑ Create the PowerPoint structure                              │
│  ☑ Define pricing tiers with time estimates                     │
│  ☑ Review process tree for different project types              │
│  ☐ ____________________________________________ (add your own)  │
│                                                                 │
│  Uncheck any that don't fit. Add more if needed.                │
│                                                                 │
│                               [← Back]  [Create Project →]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```
STEP 4 — Done
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         ✓                                       │
│                                                                 │
│  QA Strategy Presentation created!                              │
│                                                                 │
│  4 tasks ready to go.                                           │
│                                                                 │
│  [Open Project]  [Go to Focus Mode]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Quick create option:**
- Small link under Step 1: "I know what I'm doing → Quick create"
- Opens simple form: Name, Why, Done, Context
- No AI, no task suggestions

---

### 6. Copilot Panel (Cmd+K)

**When:** User presses Cmd+K from anywhere, OR clicks the copilot area in right panel.

**Purpose:** Conversational AI for help with current context.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Copilot                                              [×]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Context: QA Strategy                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ You've been working on "Create powerpoint" for 2 days.  │   │
│  │ You have 4 tasks total, 0 completed.                    │   │
│  │                                                         │   │
│  │ What do you need help with?                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  USER: I don't know where to start with the powerpoint         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Let's break it down. A QA strategy presentation         │   │
│  │ typically needs:                                        │   │
│  │                                                         │   │
│  │ 1. Intro slide — who is Craft-IT                        │   │
│  │ 2. Services overview — what you offer                   │   │
│  │ 3. Process — how you work                               │   │
│  │ 4. Pricing tiers — packages and estimates               │   │
│  │ 5. Case studies or examples                             │   │
│  │                                                         │   │
│  │ Want me to create these as subtasks?                    │   │
│  │                                                         │   │
│  │ [Yes, create subtasks]  [Let me adjust first]           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Type a message...                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- Opens as modal overlay (Cmd+K) or slides in from right (panel click)
- Shows current context at top (which project, which task if any)
- AI can take actions: create tasks, create subtasks, mark complete
- Action buttons in AI responses for quick execution
- Conversation persists during session, cleared on app close

**AI capabilities in copilot:**
- Answer "where am I on this project?"
- Break down tasks into subtasks
- Suggest next actions
- Challenge vague goals
- Summarize progress

---

### 7. Settings

**Minimal for MVP:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GENERAL                                                        │
│  ────────                                                       │
│  Name: [Quentin_______________]                                 │
│                                                                 │
│  AI                                                             │
│  ────────                                                       │
│  OpenAI API Key: [sk-...____________] [Test]                    │
│  Model: [gpt-4.5-turbo ▼]                                       │
│                                                                 │
│  DATA                                                           │
│  ────────                                                       │
│  Database location: ~/Library/Application Support/Helm          │
│  [Export all data]  [Import]                                    │
│                                                                 │
│  KEYBOARD SHORTCUTS                                             │
│  ────────                                                       │
│  Quick capture: [Cmd+Shift+N]                                   │
│  Open copilot: [Cmd+K]                                          │
│  Focus mode: [Cmd+Shift+F]                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Global Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open copilot |
| `Cmd+N` | Quick capture to inbox |
| `Cmd+Shift+F` | Toggle focus mode |
| `Cmd+Shift+N` | New project |
| `Cmd+1` | Go to Home |
| `Cmd+2` | Go to Inbox |
| `Cmd+3` | Go to Focus |
| `Cmd+Enter` | Mark selected task as done |

---

## AI Context Injection

Every AI call includes this context object:

```typescript
{
  user: {
    name: "Quentin",
    currentTime: "2025-01-05T10:30:00",
    dayOfWeek: "Sunday"
  },
  
  currentProject: {
    name: "QA Strategy",
    why: "Clarify our QA offering...",
    doneDefinition: "PowerPoint ready for clients...",
    context: "work",
    status: "active",
    createdAt: "2025-01-02",
    daysSinceCreation: 3,
    daysSinceLastActivity: 2
  },
  
  currentTask: {  // if a task is selected
    title: "Create a powerpoint of the QA Strategy",
    status: "in_progress",
    daysSinceCreation: 2,
    subtasks: []
  },
  
  projectTasks: {
    total: 4,
    completed: 0,
    inProgress: 1,
    todo: 3,
    staleTasks: ["Create a powerpoint..."]  // no activity 2+ days
  },
  
  recentActivity: [
    { action: "task_created", task: "Review sales...", timestamp: "..." },
    { action: "project_viewed", timestamp: "..." }
  ]
}
```

---

## System Prompts

### Main Copilot Prompt

```
You are Helm, a project copilot for Quentin who has ADHD.

Your personality:
- Direct and concise, never corporate
- You challenge when the user drifts from their stated goal
- You remind them of their "Why" when they get lost in details
- You celebrate progress genuinely but briefly
- You're honest when something looks stuck or abandoned
- You don't sugarcoat, but you're kind

Your capabilities:
- Help break down vague ideas into concrete, actionable tasks
- Summarize where they are in a project
- Suggest the single most logical next action
- Detect when they're stuck or avoiding something
- Keep the "Done" definition in sight

Rules:
- Always reference the project's "Why" and "Done" when relevant
- Suggest a maximum of 5 tasks at a time
- Keep responses under 150 words unless asked for detail
- When suggesting tasks, make them concrete and actionable (start with a verb)
- If you notice inactivity, gently address it
- Never be preachy about productivity

Current context:
{context}
```

### Project Kickoff Prompt

```
The user wants to create a new project. They've shared their initial thoughts below.

Your job:
1. Extract a clear, short project name (max 5 words)
2. Formulate the "Why" — the real reason they're doing this (1-2 sentences)
3. Define what "Done" looks like — concrete, measurable if possible (1-2 sentences)
4. Suggest 3-5 initial tasks to get started (concrete, actionable, start with verbs)

User's brain dump:
{userInput}

Respond in this exact JSON format:
{
  "name": "...",
  "why": "...",
  "done": "...",
  "suggestedTasks": ["...", "...", "..."]
}
```

### Daily Summary Prompt

```
Generate a brief morning summary for Quentin.

Active projects and their state:
{projectsData}

Rules:
- Start with a time-appropriate greeting
- For each active project, indicate status (on track / slow / stuck)
- Mention how long since last activity if relevant
- Suggest ONE thing to focus on today
- Keep total response under 100 words
- Be encouraging but honest
```

---

## MVP Scope

### IN (Must have)

- [x] Home with daily summary
- [x] Inbox for quick capture
- [x] Project view with List and Kanban
- [x] Task detail panel (pin/unpin)
- [x] Subtasks (one level deep for MVP)
- [x] Focus mode
- [x] Project kickoff wizard with AI
- [x] Copilot panel (Cmd+K)
- [x] Contexts (Work / Personal)
- [x] Global search
- [x] Basic keyboard shortcuts
- [x] Settings (API key, name, export)
- [x] Activity logging (for AI context)
- [x] SQLite local storage

### OUT (Phase 2+)

- [ ] Canvas view
- [ ] Notes attached to projects
- [ ] Weekly review screen
- [ ] WIP limits
- [ ] Daily planning ritual
- [ ] Pomodoro
- [ ] Themes
- [ ] Calendar view
- [ ] Inactivity detection + push notifications
- [ ] Pattern analysis (average project duration, etc.)

---

## Data Persistence

All data stored locally in SQLite:
- Location: `~/Library/Application Support/Helm/helm.db`
- Single file, easy backup
- Export to JSON available in settings

---

## Error States

| Situation | Behavior |
|-----------|----------|
| No API key set | Show banner: "Add your OpenAI API key in Settings to enable AI features" |
| API call fails | Show toast: "Couldn't reach AI. Check your connection." + Retry button |
| Empty inbox | Show friendly empty state: "Nothing here. That's a good thing." |
| Empty projects | Show: "No projects yet. Ready to start something?" + CTA |
| Focus mode, no tasks | Show: "You're all caught up! 🎉" |

---

*Document version: 1.0 — January 2025*