# The Han Plugin System - A Comprehensive Guide

## Table of Contents

1. [Overview](#overview)
2. [The Big Picture: An Analogy](#the-big-picture-an-analogy)
3. [Architecture](#architecture)
4. [Plugin Categories](#plugin-categories)
5. [MCP Servers (Tools)](#mcp-servers-tools)
6. [Hooks](#hooks)
7. [Skills](#skills)
8. [Slash Commands](#slash-commands)
9. [Specialized Agents](#specialized-agents)
10. [The Memory System](#the-memory-system)
11. [What Runs Automatically](#what-runs-automatically)
12. [What You Need to Invoke](#what-you-need-to-invoke)
13. [Quick Reference Card](#quick-reference-card)

---

## Overview

The **Han Plugin System** is a comprehensive framework that extends Claude Code's capabilities through a marketplace of plugins. Think of it as an "App Store" for AI-assisted development, providing:

- **MCP Servers** - External tools and services
- **Hooks** - Automatic behaviors triggered by events
- **Skills** - Specialized knowledge and techniques
- **Commands** - User-invocable workflows
- **Agents** - Specialized AI personalities for specific tasks

**Version**: You're running `han/core@1.7.1` from the Bushido Collective marketplace.

---

## The Big Picture: An Analogy

Imagine Claude Code is a **master craftsman**. The Han system provides:

| Component | Analogy | Purpose |
|-----------|---------|---------|
| **MCP Servers** | **Tools on the workbench** | Physical capabilities (GitHub API, browser control, documentation lookup) |
| **Hooks** | **Muscle memory/habits** | Automatic behaviors that happen without thinking |
| **Skills** | **Techniques in memory** | Knowledge of specific crafts (SOLID principles, TDD, etc.) |
| **Commands** | **Standard procedures** | Step-by-step workflows you request (like `/develop`) |
| **Agents** | **Specialist colleagues** | Experts I can call on for specific domains |
| **Bushido** | **Code of conduct** | Philosophical principles guiding all behavior |

---

## Architecture

```
~/.claude/plugins/
├── cache/han/                    # Installed plugin files
│   ├── core/1.7.1/              # Core infrastructure
│   ├── bushido/2.1.0/           # Philosophy plugin
│   ├── do-*/                    # Domain specialist agents
│   ├── jutsu-*/                 # Tooling plugins
│   └── hashi-*/                 # External service connectors
├── marketplaces/                 # Source repositories
│   ├── han/                     # Bushido Collective marketplace
│   └── claude-plugins-official/ # Anthropic official plugins
├── installed_plugins.json        # Plugin registry
└── known_marketplaces.json       # Marketplace sources
```

### Plugin Types by Naming Convention

| Prefix | Category | Purpose |
|--------|----------|---------|
| `core` | Infrastructure | Essential Han functionality |
| `bushido` | Philosophy | The seven virtues guiding behavior |
| `do-*` | Domain Experts | Specialized AI agents |
| `jutsu-*` | Tooling | Framework/language-specific validation |
| `hashi-*` | Connectors | External service integrations |

---

## Plugin Categories

### 1. Core (`core@1.7.1`)

The **brain** of the Han system. Provides:

- **Hooks**: Automatic behaviors (see [Hooks](#hooks))
- **Skills**: Universal programming principles
- **Commands**: Workflow orchestrations
- **MCP Servers**: han binary, Context7, DeepWiki

### 2. Bushido (`bushido@2.1.0`)

The **philosophy** layer. Injects the seven samurai virtues:

| Virtue | Japanese | Application |
|--------|----------|-------------|
| Righteousness | 義 (Gi) | Transparency in technical decisions |
| Courage | 勇 (Yū) | Challenge anti-patterns boldly |
| Compassion | 仁 (Jin) | Respect existing code |
| Respect | 礼 (Rei) | Honor prior implementations |
| Honesty | 誠 (Makoto) | Truthfulness over comfort |
| Honor | 名誉 (Meiyo) | Own code quality |
| Loyalty | 忠義 (Chūgi) | Long-term thinking |

### 3. Domain Experts (`do-*`)

Specialized agents for different engineering domains:

| Plugin | Version | Agents |
|--------|---------|--------|
| `do-api-engineering` | 1.1.2 | API Contract Engineer, API Designer, API Gateway Engineer |
| `do-architecture` | 1.1.2 | Solution Architect, System Architect |
| `do-backend-development` | 2.0.1 | API Designer, Backend Architect |
| `do-database-engineering` | 1.1.2 | Database Designer, Reliability Engineer, Query Optimizer |
| `do-frontend-development` | 1.1.4 | Presentation Engineer |
| `do-machine-learning-engineering` | 1.1.2 | ML Inference Engineer, Pipeline Engineer, MLOps Engineer |
| `do-project-management` | 1.1.2 | Flow Coordinator, Technical Coordinator |
| `do-quality-assurance` | 2.0.0 | Quality Strategist, Test Architect |
| `do-prompt-engineering` | 1.1.4 | Prompt Engineer |

### 4. Tooling (`jutsu-*`)

Framework-specific validation and skills:

| Plugin | Version | Purpose |
|--------|---------|---------|
| `jutsu-typescript` | 1.9.0 | TypeScript type checking, async patterns, utility types |
| `jutsu-eslint` | 1.9.0 | ESLint configuration, rules, custom plugins |
| `jutsu-prettier` | 1.9.0 | Prettier formatting, integration, plugins |
| `jutsu-playwright` | 1.4.0 | Test architecture, fixtures, page objects |
| `jutsu-markdown` | 2.3.0 | Markdown syntax, tables, markdownlint |
| `jutsu-docker-compose` | 1.9.0 | Docker Compose basics, networking, production |
| `jutsu-act` | 1.9.0 | GitHub Actions local testing |
| `jutsu-notetaker` | 1.0.1 | Code annotations, documentation linking |

### 5. Connectors (`hashi-*`)

External service integrations:

| Plugin | Version | MCP Server | Purpose |
|--------|---------|------------|---------|
| `hashi-github` | 1.1.6 | `github` | Repository, issues, PRs, code search |
| `hashi-playwright-mcp` | 1.1.3 | `playwright` | Browser automation, testing |

---

## MCP Servers (Tools)

MCP (Model Context Protocol) servers provide Claude with external capabilities. They're like **hardware peripherals** that extend what I can do.

### Currently Active MCP Servers

#### From `core@han`:

| Server | Command | Purpose |
|--------|---------|---------|
| `han` | `han mcp` | Memory, metrics, checkpoints, learning |
| `context7` | `npx @upstash/context7-mcp` | Library documentation lookup |
| `deepwiki` | HTTP MCP | GitHub repository documentation |

#### From `hashi-*`:

| Server | Command | Purpose |
|--------|---------|---------|
| `github` | Docker container | GitHub API operations |
| `playwright` | `npx @playwright/mcp` | Browser automation |

### MCP Tools Available to Claude

#### Han Tools (Memory & Metrics)

```
mcp__plugin_core_han__memory          # Query project memory
mcp__plugin_core_han__learn           # Store learnings
mcp__plugin_core_han__start_task      # Begin task tracking
mcp__plugin_core_han__complete_task   # End task tracking
mcp__plugin_core_han__checkpoint_*    # Checkpoint management
```

#### Jutsu Tools (Validation)

```
mcp__plugin_core_han__jutsu_typescript_typecheck  # Run tsc
mcp__plugin_core_han__jutsu_eslint_lint           # Run eslint
mcp__plugin_core_han__jutsu_prettier_format       # Check formatting
mcp__plugin_core_han__jutsu_playwright_test       # Run Playwright tests
mcp__plugin_core_han__jutsu_markdown_lint         # Lint markdown
mcp__plugin_core_han__jutsu_act_validate          # Validate GH Actions
mcp__plugin_core_han__jutsu_docker_compose_validate # Validate compose
```

#### GitHub Tools

```
mcp__plugin_hashi-github_github__list_issues
mcp__plugin_hashi-github_github__create_pull_request
mcp__plugin_hashi-github_github__search_code
mcp__plugin_hashi-github_github__get_file_contents
# ... 40+ GitHub operations
```

#### Playwright Tools

```
mcp__plugin_hashi-playwright-mcp_playwright__browser_navigate
mcp__plugin_hashi-playwright-mcp_playwright__browser_click
mcp__plugin_hashi-playwright-mcp_playwright__browser_snapshot
mcp__plugin_hashi-playwright-mcp_playwright__browser_type
# ... full browser automation suite
```

#### Context7 Tools

```
mcp__plugin_core_context7__resolve-library-id  # Find library docs
mcp__plugin_core_context7__query-docs          # Get documentation
```

#### DeepWiki Tools

```
mcp__plugin_core_deepwiki__read_wiki_structure  # Get repo doc structure
mcp__plugin_core_deepwiki__read_wiki_contents   # Read documentation
mcp__plugin_core_deepwiki__ask_question         # Ask about a repo
```

---

## Hooks

Hooks are **automatic behaviors** that run in response to events. They're like reflexes - I don't consciously invoke them; they happen automatically.

### Hook Events

| Event | When It Fires |
|-------|---------------|
| `SessionStart` | When a new Claude Code session begins |
| `UserPromptSubmit` | Every time you send a message |
| `PreToolUse` | Before I use a tool |
| `PostToolUse` | After I use a tool |
| `SubagentStart` | When I launch a subagent |

### Active Hooks (from `core@1.7.1`)

#### SessionStart Hooks

| Hook | What It Does |
|------|--------------|
| `install-han-binary.sh` | Ensures the `han` CLI is installed |
| `han metrics session-context` | Loads metrics context |
| `no-time-estimates.md` | Reminds me never to give time estimates |
| `metrics-tracking.md` | Instructs task tracking protocol |

#### UserPromptSubmit Hooks

| Hook | What It Does |
|------|--------------|
| `ensure-subagent.md` | **Forces delegation** - I orchestrate, agents implement |
| `ensure-skill-use.md` | Mandates skill selection before work |
| `professional-honesty.md` | Requires verification before accepting claims |
| `no-excuses.md` | Prohibits blaming "pre-existing issues" |
| `bash-output-capture.md` | Requires piping to files, not truncating |
| `memory-learning.md` | Enables autonomous learning |
| `memory-confidence.md` | Triggers memory lookup for low-confidence answers |

#### PreToolUse Hooks

| Hook | What It Does |
|------|--------------|
| `pre-push-check.sh` | Validates before git push operations |

#### SubagentStart Hooks

| Hook | What It Does |
|------|--------------|
| `han checkpoint capture` | Creates checkpoint before subagent work |

#### PostToolUse Hooks

| Hook | What It Does |
|------|--------------|
| `han memory capture` | Captures context after tool use |

---

## Skills

Skills are **specialized knowledge** that I apply when relevant. They're like "mental techniques" or "areas of expertise."

### Core Skills (from `core@1.7.1`)

| Skill | When I Use It |
|-------|---------------|
| `architecture-design` | Designing system architecture |
| `baseline-restorer` | Recovering from failed fix attempts |
| `boy-scout-rule` | Modifying existing code |
| `code-reviewer` | Conducting code reviews |
| `debugging` | Investigating bugs |
| `documentation` | Creating/updating docs |
| `explainer` | Explaining code/concepts |
| `legacy-code-safety` | Modifying untested code |
| `orthogonality-principle` | Designing independent modules |
| `performance-optimization` | Optimizing for performance |
| `professional-honesty` | Providing objective assessments |
| `project-memory` | Managing Claude Code memory |
| `proof-of-work` | Providing evidence for claims |
| `refactoring` | Restructuring code safely |
| `simplicity-principles` | KISS, YAGNI, Least Astonishment |
| `solid-principles` | SOLID OOP principles |
| `structural-design-principles` | Composition, Law of Demeter |
| `technical-planning` | Creating implementation plans |

### Jutsu Skills (Technology-Specific)

#### TypeScript (`jutsu-typescript`)
- `typescript-async-patterns` - Promises, async/await
- `typescript-type-system` - Advanced types, generics
- `typescript-utility-types` - Mapped types, manipulation

#### Playwright (`jutsu-playwright`)
- `playwright-fixtures-and-hooks` - Test setup/teardown
- `playwright-page-object-model` - POM patterns
- `playwright-test-architecture` - Project organization

#### ESLint (`jutsu-eslint`)
- `eslint-configuration` - Config file setup
- `eslint-custom` - Custom rules development
- `eslint-rules` - Built-in rules

#### Prettier (`jutsu-prettier`)
- `prettier-configuration` - Options and config
- `prettier-integration` - Editor/CI integration
- `prettier-plugins` - Plugin ecosystem

#### Markdown (`jutsu-markdown`)
- `markdown-syntax-fundamentals` - Core syntax
- `markdown-tables` - Table formatting
- `markdown-documentation` - Technical writing
- `markdownlint-*` - Linting configuration

#### Docker Compose (`jutsu-docker-compose`)
- `docker-compose-basics` - YAML configuration
- `docker-compose-networking` - Service communication
- `docker-compose-production` - Production deployment

#### Act (`jutsu-act`)
- `act-local-testing` - Testing GH Actions locally
- `act-docker-setup` - Docker environment
- `act-workflow-syntax` - Workflow creation

#### Notetaker (`jutsu-notetaker`)
- `code-annotation-patterns` - Structured metadata
- `documentation-linking` - Bidirectional links
- `note-taking-fundamentals` - Development notes

---

## Slash Commands

Slash commands are **user-invocable workflows**. Use them by typing `/command-name`.

### Available Commands (from `core`)

| Command | Usage | Description |
|---------|-------|-------------|
| `/architect` | `/architect [description]` | Design system architecture |
| `/code-review` | `/code-review [PR/file]` | Code review a pull request |
| `/debug` | `/debug [issue]` | Investigate and diagnose issues |
| `/develop` | `/develop [feature]` | **7-phase feature development workflow** |
| `/document` | `/document [target]` | Generate documentation |
| `/explain` | `/explain [code/concept]` | Explain code or concepts |
| `/fix` | `/fix [bug]` | Debug and fix bugs |
| `/optimize` | `/optimize [code]` | Optimize for performance |
| `/plan` | `/plan [task]` | Create implementation plan |
| `/refactor` | `/refactor [code]` | Restructure code safely |
| `/review` | `/review` | Multi-agent code review |
| `/test` | `/test [code]` | Write tests with TDD |

### GitHub Commands (from `hashi-github`)

| Command | Usage | Description |
|---------|-------|-------------|
| `/create-issue` | `/create-issue [details]` | Create GitHub issue |
| `/create-pr` | `/create-pr [branch]` | Create pull request |
| `/review-pr` | `/review-pr [number]` | Review GitHub PR |
| `/search-code` | `/search-code [query]` | Search code on GitHub |
| `/view-workflow` | `/view-workflow` | View GH Actions runs |

---

## Specialized Agents

Agents are **specialized AI personalities** that I delegate work to. The `ensure-subagent` hook mandates that I orchestrate rather than implement directly.

### How Delegation Works

```
You (User)
    │
    ├─► Claude (Orchestrator)
    │       │
    │       ├─► Agent A (async) ─┐
    │       ├─► Agent B (async) ─┼─► Consolidate ─► Report to you
    │       └─► Agent C (async) ─┘
```

### Built-in Agent Types

| Agent | Use For |
|-------|---------|
| `Explore` | Quick codebase exploration |
| `Plan` | Implementation planning |
| `general-purpose` | Complex multi-step tasks |
| `Bash` | Command execution |

### Domain Specialist Agents (`do-*`)

These are invoked via the `Task` tool with `subagent_type`:

| Subagent Type | Specialization |
|---------------|----------------|
| `do-api-engineering:api-designer` | API design and contracts |
| `do-api-engineering:api-contract-engineer` | OpenAPI, schema validation |
| `do-api-engineering:api-gateway-engineer` | Rate limiting, auth, routing |
| `do-architecture:solution-architect` | Technical problem-solving |
| `do-architecture:system-architect` | System design, quality attributes |
| `do-backend-development:api-designer` | REST/GraphQL API design |
| `do-backend-development:backend-architect` | Data models, pipelines |
| `do-database-engineering:database-designer` | Schema design, normalization |
| `do-database-engineering:query-optimizer` | Query performance, indexing |
| `do-database-engineering:database-reliability-engineer` | Backup, HA, operations |
| `do-frontend-development:presentation-engineer` | UI/UX, visual design |
| `do-machine-learning-engineering:ml-inference-engineer` | Model serving, optimization |
| `do-machine-learning-engineering:ml-pipeline-engineer` | Training pipelines, features |
| `do-machine-learning-engineering:mlops-engineer` | ML deployment, monitoring |
| `do-project-management:flow-coordinator` | Workflow orchestration |
| `do-project-management:technical-coordinator` | Technical planning |
| `do-quality-assurance:quality-strategist` | Testing strategy |
| `do-quality-assurance:test-architect` | Test organization, fixtures |
| `do-prompt-engineering:prompt-engineer` | Prompt crafting, AI workflows |
| `hashi-playwright-mcp:test-generator` | Generate Playwright tests |
| `hashi-playwright-mcp:ui-debugger` | Debug UI issues |

---

## The Memory System

Han provides **persistent memory** through the `learn` and `memory` MCP tools.

### How It Works

```
Project Rules:
.claude/rules/
├── api.md           # API conventions
├── testing.md       # Testing patterns
├── commands.md      # Project commands
└── preferences.md   # User preferences

User Rules (apply to all projects):
~/.claude/rules/
└── preferences.md   # Personal preferences
```

### Learning (Autonomous)

When I discover something worth remembering:

```javascript
// I call this automatically
learn({
  content: "# Testing\n\n- Use vitest, not jest",
  domain: "testing"
})
```

### Querying Memory

When answering questions with low confidence:

```javascript
// I call this to check what I know
memory({ question: "How do we handle API errors?" })
```

---

## What Runs Automatically

These happen **without you doing anything**:

### Every Session Start

1. Han CLI installation check
2. Metrics context loading
3. Time estimate prohibition
4. Task tracking instructions
5. Bushido virtues injection

### Every Message You Send

1. Subagent delegation mandate loaded
2. Skill selection requirement loaded
3. Professional honesty protocol loaded
4. No-excuses policy loaded
5. Bash output capture rules loaded
6. Memory learning capability enabled
7. Memory confidence checking enabled
8. Frustration detection scan

### When I Use Tools

- Pre-tool: Push validation checks
- Post-tool: Memory capture

### When I Launch Subagents

- Checkpoint created automatically

---

## What You Need to Invoke

### Slash Commands (Type These)

```bash
# Feature development
/develop Add user authentication

# Code review
/review

# Planning
/plan Implement caching layer

# Debugging
/debug Users can't log in

# Testing
/test UserService

# GitHub operations
/create-pr main
/review-pr 123
```

### Explicit Requests

Some things happen only when you ask:

| Request | What Happens |
|---------|--------------|
| "Run the tests" | I use Jutsu test tools |
| "Check types" | I use TypeScript typecheck tool |
| "Lint the code" | I use ESLint lint tool |
| "Format code" | I use Prettier format tool |
| "Search GitHub for X" | I use GitHub code search |
| "Navigate to URL" | I use Playwright browser tools |
| "Look up React docs" | I use Context7 to fetch docs |

### Implicit Invocations

Some things I do automatically based on context:

| Situation | What I Do |
|-----------|-----------|
| You mention a library I don't know | Query Context7 for docs |
| You ask about a GitHub repo | Query DeepWiki for docs |
| Complex implementation task | Delegate to specialized agents |
| Code modification | Apply boy-scout-rule skill |
| Design question | Use relevant architecture skill |

---

## Quick Reference Card

### What's Automatic

| Category | Items |
|----------|-------|
| **Loaded at start** | Bushido virtues, no-time-estimates, metrics-tracking |
| **On every message** | ensure-subagent, ensure-skill-use, professional-honesty, no-excuses, bash-output-capture, memory hooks |
| **On tool use** | pre-push-check, memory-capture |
| **On subagent** | checkpoint-capture |

### What You Invoke

| Category | How to Invoke |
|----------|---------------|
| **Development workflow** | `/develop`, `/fix`, `/debug`, `/refactor` |
| **Quality** | `/review`, `/test`, `/code-review` |
| **Planning** | `/plan`, `/architect` |
| **Documentation** | `/document`, `/explain` |
| **GitHub** | `/create-pr`, `/review-pr`, `/create-issue` |
| **Validation tools** | "run tests", "check types", "lint code" |
| **Browser automation** | "navigate to X", "click on Y" |

### Plugin Prefixes

| Prefix | Meaning |
|--------|---------|
| `core` | Essential infrastructure |
| `bushido` | Philosophy/virtues |
| `do-` | Domain expert agents |
| `jutsu-` | Tooling/validation |
| `hashi-` | External service connectors |

---

## Summary

The Han Plugin System transforms Claude Code into a **comprehensive development environment** with:

1. **Automatic behaviors** (hooks) that enforce quality and best practices
2. **External tools** (MCP servers) for GitHub, browser automation, documentation
3. **Specialized knowledge** (skills) for every aspect of software development
4. **User workflows** (commands) for common development tasks
5. **Expert delegation** (agents) for domain-specific work
6. **Persistent memory** (learning) that grows with your project

The philosophy is clear: **I orchestrate, specialists implement, quality is non-negotiable.**
