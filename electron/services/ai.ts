import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { db } from '../database/db'
import { searchDocuments } from './documents'

// Conversation message type for history
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// Limit history to avoid token overflow
const MAX_HISTORY_MESSAGES = 20 // Keep last 20 messages (10 exchanges)

function trimHistory(history: ConversationMessage[]): ConversationMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history
  }
  return history.slice(-MAX_HISTORY_MESSAGES)
}

// AI Context for injecting into prompts
interface AIContext {
  user: {
    name: string
    currentTime: string
    dayOfWeek: string
  }
  currentProject?: {
    id: string
    name: string
    why: string
    doneDefinition: string
    status: string
    context: string
  }
  currentTask?: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string | null
    dueDate: string | null
  }
  currentQuickTodo?: {
    id: string
    title: string
    description: string | null
    list: string
    priority: string | null
    dueDate: string | null
    completed: boolean
  }
  projectTasks?: {
    total: number
    completed: number
    inProgress: number
    todo: number
    taskList: Array<{ title: string; status: string }>
  }
  recentActivity?: Array<{
    action: string
    details: string
    time: string
  }>
  relevantDocuments?: Array<{
    documentName: string
    content: string
    relevance: number
  }>
  attachedDocuments?: Array<{
    name: string
    extractedText: string | null
  }>
  attachedSources?: Array<{
    title: string
    url: string
    description: string | null
    sourceType: string
  }>
  recentConversations?: Array<{
    userMessage: string
    aiResponse: string
  }>
}

// Build context for AI prompts
export function buildContext(projectId?: string, taskId?: string, quickTodoId?: string): AIContext {
  const settings = db.settings.getAll()
  const now = new Date()

  const context: AIContext = {
    user: {
      name: settings.name || 'User',
      currentTime: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' })
    }
  }

  // Quick Todo context (takes priority over project/task)
  if (quickTodoId) {
    const quickTodo = db.quickTodos.getById(quickTodoId)
    if (quickTodo) {
      context.currentQuickTodo = {
        id: quickTodo.id,
        title: quickTodo.title,
        description: quickTodo.description,
        list: quickTodo.list,
        priority: quickTodo.priority,
        dueDate: quickTodo.due_date,
        completed: quickTodo.completed
      }

      // Get documents attached to this quick todo
      const docs = db.documents.getByQuickTodo(quickTodoId)
      if (docs.length > 0) {
        context.attachedDocuments = docs
          .filter(d => d.processing_status === 'completed')
          .slice(0, 5)
          .map(d => ({
            name: d.name,
            extractedText: d.extracted_text ? d.extracted_text.substring(0, 2000) : null
          }))
      }

      // Get sources attached to this quick todo
      const sources = db.sources.getByQuickTodo(quickTodoId)
      if (sources.length > 0) {
        context.attachedSources = sources.slice(0, 10).map(s => ({
          title: s.title,
          url: s.url,
          description: s.description,
          sourceType: s.source_type
        }))
      }
    }
    return context
  }

  // Task context
  if (taskId) {
    const task = db.tasks.getById(taskId)
    if (task) {
      context.currentTask = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date
      }

      // Get documents attached to this task
      const taskDocs = db.documents.getByTask(taskId)
      if (taskDocs.length > 0) {
        context.attachedDocuments = taskDocs
          .filter(d => d.processing_status === 'completed')
          .slice(0, 5)
          .map(d => ({
            name: d.name,
            extractedText: d.extracted_text ? d.extracted_text.substring(0, 2000) : null
          }))
      }

      // Get sources attached to this task
      const taskSources = db.sources.getByTask(taskId)
      if (taskSources.length > 0) {
        context.attachedSources = taskSources.slice(0, 10).map(s => ({
          title: s.title,
          url: s.url,
          description: s.description,
          sourceType: s.source_type
        }))
      }
    }
  }

  // Project context
  if (projectId) {
    const project = db.projects.getById(projectId)
    if (project) {
      context.currentProject = {
        id: project.id,
        name: project.name,
        why: project.why,
        doneDefinition: project.done_definition,
        status: project.status,
        context: project.context
      }

      const tasks = db.tasks.getByProject(projectId)
      context.projectTasks = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'done').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        todo: tasks.filter(t => t.status === 'todo').length,
        taskList: tasks.slice(0, 10).map(t => ({ title: t.title, status: t.status }))
      }

      const activity = db.activityLog.getRecent(projectId, 5)
      context.recentActivity = activity.map(a => ({
        action: a.action_type,
        details: a.details || '',
        time: a.created_at
      }))

      // If no task-specific sources, get project-level sources
      if (!context.attachedSources || context.attachedSources.length === 0) {
        const projectSources = db.sources.getByProject(projectId)
        if (projectSources.length > 0) {
          context.attachedSources = projectSources.slice(0, 10).map(s => ({
            title: s.title,
            url: s.url,
            description: s.description,
            sourceType: s.source_type
          }))
        }
      }

      // Load recent conversations from previous sessions
      const recentConvos = db.aiConversations.getRecent(projectId, 3)
      if (recentConvos.length > 0) {
        context.recentConversations = recentConvos.map(c => ({
          userMessage: c.user_message,
          aiResponse: c.ai_response
        }))
      }
    }
  }

  return context
}

// System prompt for the copilot
function buildSystemPrompt(context: AIContext): string {
  let prompt = `You are Helm's AI copilot - a friendly, concise assistant helping ${context.user.name} manage personal projects. You're designed to help people with ADHD stay focused and make progress.

Current time: ${context.user.currentTime} on ${context.user.dayOfWeek}

Your personality:
- Brief and actionable (no fluff)
- Encouraging but realistic
- Focus on the next concrete step
- Help break down overwhelming tasks`

  // Quick Todo context (highest priority)
  if (context.currentQuickTodo) {
    prompt += `

CURRENT QUICK TODO: "${context.currentQuickTodo.title}"
- List: ${context.currentQuickTodo.list}
- Status: ${context.currentQuickTodo.completed ? 'Completed' : 'Active'}
${context.currentQuickTodo.description ? `- Description: ${context.currentQuickTodo.description}` : ''}
${context.currentQuickTodo.priority ? `- Priority: ${context.currentQuickTodo.priority}` : ''}
${context.currentQuickTodo.dueDate ? `- Due: ${context.currentQuickTodo.dueDate}` : ''}`
  }

  // Task context
  if (context.currentTask) {
    prompt += `

CURRENT TASK: "${context.currentTask.title}"
- Status: ${context.currentTask.status}
${context.currentTask.description ? `- Description: ${context.currentTask.description}` : ''}
${context.currentTask.priority ? `- Priority: ${context.currentTask.priority}` : ''}
${context.currentTask.dueDate ? `- Due: ${context.currentTask.dueDate}` : ''}`
  }

  // Project context
  if (context.currentProject) {
    prompt += `

CURRENT PROJECT: "${context.currentProject.name}"
- Why: ${context.currentProject.why || 'Not defined'}
- Done when: ${context.currentProject.doneDefinition || 'Not defined'}
- Status: ${context.currentProject.status}
- Context: ${context.currentProject.context}`
  }

  if (context.projectTasks) {
    prompt += `

TASKS: ${context.projectTasks.completed}/${context.projectTasks.total} completed
- To Do: ${context.projectTasks.todo}
- In Progress: ${context.projectTasks.inProgress}
- Done: ${context.projectTasks.completed}

Current tasks:
${context.projectTasks.taskList.map(t => `- [${t.status}] ${t.title}`).join('\n')}`
  }

  // Attached documents (task/quick todo specific)
  if (context.attachedDocuments && context.attachedDocuments.length > 0) {
    prompt += `

ATTACHED DOCUMENTS:
${context.attachedDocuments.map((doc, i) => {
  const content = doc.extractedText ? doc.extractedText.substring(0, 1500) : '(No text extracted)'
  return `[${i + 1}] "${doc.name}":
${content}${doc.extractedText && doc.extractedText.length > 1500 ? '...' : ''}`
}).join('\n\n')}`
  }

  // Attached sources (URLs)
  if (context.attachedSources && context.attachedSources.length > 0) {
    prompt += `

REFERENCE SOURCES (URLs):
${context.attachedSources.map((s, i) => `[${i + 1}] ${s.title} (${s.sourceType})
   URL: ${s.url}
   ${s.description ? `Description: ${s.description}` : ''}`).join('\n')}`
  }

  // RAG-retrieved documents (semantic search results)
  if (context.relevantDocuments && context.relevantDocuments.length > 0) {
    prompt += `

RELEVANT DOCUMENTS (from search):
${context.relevantDocuments.map((doc, i) => `[${i + 1}] From "${doc.documentName}":
${doc.content}
`).join('\n')}`
  }

  if (context.recentConversations && context.recentConversations.length > 0) {
    prompt += `

RECENT CONVERSATIONS (from previous sessions):
${context.recentConversations.map(c => `User asked: "${c.userMessage.substring(0, 100)}${c.userMessage.length > 100 ? '...' : ''}"
You answered: "${c.aiResponse.substring(0, 150)}${c.aiResponse.length > 150 ? '...' : ''}"`).join('\n\n')}`
  }

  prompt += `

Guidelines:
- Keep responses under 150 words unless asked for detail
- Suggest ONE clear next action when appropriate
- If user seems stuck, offer to break things down
- Don't be preachy about productivity - just help
- When referencing document content, cite the document name
- When referencing sources, mention the source title and you can suggest the user check the URL`

  return prompt
}

// Chat with the copilot
export async function chat(
  message: string,
  projectId?: string,
  taskId?: string,
  quickTodoId?: string,
  conversationHistory: ConversationMessage[] = []
): Promise<{ response: string; conversationId: string }> {
  const apiKey = db.settings.get('openai_api_key')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.')
  }

  const openai = new OpenAI({ apiKey })
  const context = buildContext(projectId, taskId, quickTodoId)

  // Search for relevant documents using RAG (skip if we have a quick todo - use attached docs instead)
  if (!quickTodoId) {
    try {
      const relevantDocs = await searchDocuments(message, {
        projectId,
        taskId,
        limit: 3
      })

      if (relevantDocs.length > 0) {
        // Only include documents with decent relevance (similarity > 0.3)
        context.relevantDocuments = relevantDocs.filter(doc => doc.relevance > 0.3)
      }
    } catch (err) {
      // RAG search failed, continue without document context
      console.error('RAG search failed:', err)
    }
  }

  const systemPrompt = buildSystemPrompt(context)

  // Build messages array with full conversation history
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...trimHistory(conversationHistory),
    { role: 'user', content: message }
  ]

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7
    })

    const response = completion.choices[0]?.message?.content || 'I couldn\'t generate a response. Please try again.'

    // Save conversation to database
    const conversation = db.aiConversations.save({
      project_id: projectId || null,
      task_id: taskId || null,
      user_message: message,
      ai_response: response,
      feedback: null
    })

    return {
      response,
      conversationId: conversation.id
    }
  } catch (error) {
    const err = error as Error
    if (err.message.includes('API key')) {
      throw new Error('Invalid OpenAI API key. Please check your settings.')
    }
    throw new Error(`AI request failed: ${err.message}`)
  }
}

// Parse a brain dump into project structure
export interface ParsedProject {
  name: string
  why: string
  doneDefinition: string
  context: 'work' | 'personal'
  tasks: string[]
}

export async function parseProjectBrainDump(brainDump: string): Promise<ParsedProject> {
  const apiKey = db.settings.get('openai_api_key')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.')
  }

  const openai = new OpenAI({ apiKey })
  const settings = db.settings.getAll()
  const userName = settings.name || 'User'

  const systemPrompt = `You are helping ${userName} create a new project from their thoughts. Extract structured information from their brain dump.

Return a JSON object with exactly this structure:
{
  "name": "Short, clear project name (2-5 words)",
  "why": "The core motivation/purpose (1-2 sentences)",
  "doneDefinition": "Clear success criteria - what does 'done' look like? (1-2 sentences)",
  "context": "work" or "personal",
  "tasks": ["Task 1", "Task 2", ...] (3-7 concrete first steps, each starting with a verb)
}

Guidelines:
- Project name should be actionable (e.g., "Build Portfolio Website" not "Website stuff")
- Why should capture the emotional/practical reason
- Done definition should be measurable or clearly observable
- Tasks should be small enough to complete in one sitting
- If context isn't clear, default to "personal"
- Only return valid JSON, no markdown or explanation`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: brainDump }
      ],
      max_tokens: 800,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    const parsed = JSON.parse(content) as ParsedProject

    // Validate the response
    if (!parsed.name || !parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('Invalid response structure from AI')
    }

    // Ensure context is valid
    if (parsed.context !== 'work' && parsed.context !== 'personal') {
      parsed.context = 'personal'
    }

    return parsed
  } catch (error) {
    const err = error as Error
    if (err.message.includes('API key')) {
      throw new Error('Invalid OpenAI API key. Please check your settings.')
    }
    if (err.message.includes('JSON')) {
      throw new Error('Failed to parse AI response. Please try again.')
    }
    throw new Error(`Failed to parse project: ${err.message}`)
  }
}

// Generate task breakdown suggestions
export async function suggestTaskBreakdown(
  taskTitle: string,
  projectContext?: string
): Promise<string[]> {
  const apiKey = db.settings.get('openai_api_key')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.')
  }

  const openai = new OpenAI({ apiKey })

  const systemPrompt = `Break down the given task into 3-5 smaller, actionable subtasks.

Rules:
- Each subtask should be completable in one sitting (15-60 minutes)
- Start each subtask with a verb
- Be specific and concrete
- Consider dependencies - order matters
${projectContext ? `\nProject context: ${projectContext}` : ''}

Return a JSON object: { "subtasks": ["subtask1", "subtask2", ...] }`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Break down this task: "${taskTitle}"` }
      ],
      max_tokens: 400,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    const parsed = JSON.parse(content) as { subtasks: string[] }
    return parsed.subtasks || []
  } catch (error) {
    const err = error as Error
    throw new Error(`Failed to generate breakdown: ${err.message}`)
  }
}

// Update conversation feedback
export function updateFeedback(conversationId: string, feedback: 'helpful' | 'not_helpful'): void {
  // This would need a new db method, but for now we'll skip it
  console.log(`Feedback for ${conversationId}: ${feedback}`)
}
