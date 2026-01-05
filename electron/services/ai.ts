import OpenAI from 'openai'
import { db } from '../database/db'

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
}

// Build context for AI prompts
export function buildContext(projectId?: string): AIContext {
  const settings = db.settings.getAll()
  const now = new Date()

  const context: AIContext = {
    user: {
      name: settings.name || 'User',
      currentTime: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' })
    }
  }

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

  prompt += `

Guidelines:
- Keep responses under 150 words unless asked for detail
- Suggest ONE clear next action when appropriate
- If user seems stuck, offer to break things down
- Don't be preachy about productivity - just help`

  return prompt
}

// Chat with the copilot
export async function chat(
  message: string,
  projectId?: string,
  taskId?: string
): Promise<{ response: string; conversationId: string }> {
  const apiKey = db.settings.get('openai_api_key')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in Settings.')
  }

  const openai = new OpenAI({ apiKey })
  const context = buildContext(projectId)
  const systemPrompt = buildSystemPrompt(context)

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
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
