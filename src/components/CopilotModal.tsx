import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Send, Loader2, Sparkles, RotateCcw, CheckSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { useUIStore, useProjectsStore, useCopilotStore, useQuickTodosStore, useTasksStore } from '../store'
import type { Task } from '../types/global'
import type { CopilotMessage } from '../store/copilotStore'
import { CodeBlock } from './CodeBlock'
import { TaskMentionDropdown } from './copilot/TaskMentionDropdown'
import { TaskMentionChip } from './copilot/TaskMentionChip'
import { SubtaskSuggestions } from './copilot/SubtaskSuggestions'

// Maximum number of tasks to show in the mention dropdown
const MAX_MENTION_RESULTS = 8

export function CopilotModal() {
  const { isCopilotOpen, copilotContext, closeCopilot } = useUIStore()
  const { projects } = useProjectsStore()
  const { todos } = useQuickTodosStore()
  const { tasks, isLoading: isTasksLoading } = useTasksStore()
  const { messages, addMessage, clearMessages, setContext, linkedTask, setLinkedTask } = useCopilotStore()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // @ mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Create a map of project IDs to project names for display
  const projectNames = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[project.id] = project.name
      return acc
    }, {} as Record<string, string>)
  }, [projects])

  // Filter tasks based on mention query, project context, and completion status
  const filteredTasks = useMemo(() => {
    const query = mentionQuery.toLowerCase()
    return tasks
      .filter(task => {
        // Exclude completed tasks
        if (task.status === 'done') return false

        // Filter by project if in project context
        if (copilotContext?.projectId && task.project_id !== copilotContext.projectId) {
          return false
        }

        // Match title query
        return task.title.toLowerCase().includes(query)
      })
      .slice(0, MAX_MENTION_RESULTS)
  }, [tasks, mentionQuery, copilotContext?.projectId])

  // Get current project if context is provided
  const currentProject = copilotContext?.projectId
    ? projects.find(p => p.id === copilotContext.projectId)
    : null

  // Get current quick todo if context is provided
  const currentQuickTodo = copilotContext?.quickTodoId
    ? todos.find(t => t.id === copilotContext.quickTodoId)
    : null

  // Track context changes - clear conversation if context changes
  useEffect(() => {
    if (isCopilotOpen) {
      setContext(copilotContext || null)
    }
  }, [isCopilotOpen, copilotContext, setContext])

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isCopilotOpen) {
      inputRef.current?.focus()
      setError(null)
    }
  }, [isCopilotOpen])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset mention selection when filtered results change
  useEffect(() => {
    setMentionSelectedIndex(0)
  }, [filteredTasks])

  // Reset mention state when modal closes
  useEffect(() => {
    if (!isCopilotOpen) {
      setShowMentionDropdown(false)
      setMentionQuery('')
      setMentionSelectedIndex(0)
    }
  }, [isCopilotOpen])

  // Global escape key handler to close modal
  useEffect(() => {
    if (!isCopilotOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If mention dropdown is open, just dismiss it first
        if (showMentionDropdown) {
          setShowMentionDropdown(false)
          setMentionQuery('')
        } else {
          closeCopilot()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isCopilotOpen, showMentionDropdown, closeCopilot])

  if (!isCopilotOpen) return null

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userContent = input.trim()

    // Capture and clear linked task for this message BEFORE adding message
    const taskIdForMessage = linkedTask?.id || copilotContext?.taskId
    const linkedTaskTitle = linkedTask?.title

    // Add user message to store with linked task info
    addMessage({
      role: 'user',
      content: userContent,
      linkedTaskId: taskIdForMessage,
      linkedTaskTitle
    })
    setInput('')
    setIsLoading(true)
    setError(null)
    setLinkedTask(null)

    try {
      // Pass conversation history to API
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await window.api.copilot.chat(
        userContent,
        copilotContext?.projectId,
        taskIdForMessage,
        copilotContext?.quickTodoId,
        conversationHistory
      )

      // Handle the response based on type
      if (response.type === 'subtasks' && response.suggestions) {
        // Store subtask suggestions along with the message
        addMessage({
          role: 'assistant',
          content: response.content,
          suggestions: response.suggestions,
          linkedTaskId: taskIdForMessage
        })
      } else {
        // Regular message response
        addMessage({ role: 'assistant', content: response.content })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention dropdown navigation
    if (showMentionDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionSelectedIndex(prev =>
          prev < filteredTasks.length - 1 ? prev + 1 : 0
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredTasks.length - 1
        )
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        // Both Enter and Space select the current item
        e.preventDefault()
        if (filteredTasks[mentionSelectedIndex]) {
          handleTaskSelect(filteredTasks[mentionSelectedIndex])
        }
        return
      }
      if (e.key === 'Tab') {
        // Tab dismisses the dropdown and allows normal tab behavior
        dismissMentionDropdown()
        return // Don't prevent default - let tab proceed to send button
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissMentionDropdown()
        return
      }
    }

    // Normal input handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      closeCopilot()
    }
  }

  const handleClose = () => {
    closeCopilot()
  }

  // Handle input changes and detect @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)

    // Find the last @ symbol and extract the query after it
    const atIndex = value.lastIndexOf('@')
    if (atIndex !== -1) {
      // Check if @ is at the start or preceded by a space (not in the middle of a word)
      const charBefore = atIndex > 0 ? value[atIndex - 1] : ' '
      if (charBefore === ' ' || atIndex === 0) {
        const query = value.slice(atIndex + 1)
        // Show dropdown if there's no space after the query (still typing)
        if (!query.includes(' ')) {
          setShowMentionDropdown(true)
          setMentionQuery(query)
          return
        }
      }
    }

    // Hide dropdown if no valid @ mention in progress
    setShowMentionDropdown(false)
    setMentionQuery('')
  }

  // Handle task selection from dropdown
  const handleTaskSelect = (task: Task) => {
    setLinkedTask(task)
    // Remove the @query from input
    const atIndex = input.lastIndexOf('@')
    if (atIndex !== -1) {
      setInput(input.slice(0, atIndex).trimEnd())
    }
    dismissMentionDropdown()
    inputRef.current?.focus()
  }

  // Dismiss mention dropdown and reset state
  const dismissMentionDropdown = () => {
    setShowMentionDropdown(false)
    setMentionQuery('')
    setMentionSelectedIndex(0)
  }

  // Remove linked task
  const handleRemoveLinkedTask = () => {
    setLinkedTask(null)
    inputRef.current?.focus()
  }

  // Quick prompts for empty state
  const quickPrompts = currentQuickTodo
    ? [
        'Help me get started on this',
        'What\'s the first step?',
        'Break this down for me'
      ]
    : currentProject
    ? [
        'What should I work on next?',
        'Help me break down my current tasks',
        'How am I progressing on this project?'
      ]
    : [
        'Help me plan my day',
        'What projects need attention?',
        'I\'m feeling stuck - what should I do?'
      ]

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop">
      <div className="bg-helm-surface border border-helm-border rounded-xl w-full max-w-xl h-[70vh] flex flex-col modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-helm-border">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-helm-primary" />
            <div>
              <h2 className="font-medium text-helm-text">Jeeves</h2>
              {currentQuickTodo ? (
                <p className="text-xs text-helm-text-muted">
                  Todo: {currentQuickTodo.title.substring(0, 30)}{currentQuickTodo.title.length > 30 ? '...' : ''}
                </p>
              ) : currentProject ? (
                <p className="text-xs text-helm-text-muted">
                  Project: {currentProject.name}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="p-2 text-helm-text-muted hover:text-helm-text rounded-lg hover:bg-helm-surface-elevated transition-colors"
                title="New conversation"
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 text-helm-text-muted hover:text-helm-text rounded-lg hover:bg-helm-surface-elevated transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
              <Sparkles size={32} className="text-helm-primary mb-4" />
              <h3 className="text-helm-text font-medium mb-2">How can I help?</h3>
              <p className="text-sm text-helm-text-muted mb-6 max-w-xs">
                {currentQuickTodo
                  ? `I can see your todo "${currentQuickTodo.title.substring(0, 40)}${currentQuickTodo.title.length > 40 ? '...' : ''}" and its attachments.`
                  : currentProject
                  ? `I have context about "${currentProject.name}". Ask me anything!`
                  : 'Ask me about your projects, tasks, or what to work on next.'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(prompt)}
                    className="px-3 py-1.5 bg-helm-bg border border-helm-border rounded-full text-sm text-helm-text-muted hover:text-helm-text hover:border-helm-primary transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-helm-text-muted">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 p-3 bg-helm-error/10 border border-helm-error/20 rounded-lg">
            <p className="text-sm text-helm-error">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-helm-border">
          {/* Linked task chip */}
          {linkedTask && (
            <div className="mb-2">
              <TaskMentionChip task={linkedTask} onRemove={handleRemoveLinkedTask} />
            </div>
          )}

          {/* Input wrapper with relative positioning for dropdown */}
          <div className="relative">
            {/* Task mention dropdown */}
            <TaskMentionDropdown
              isVisible={showMentionDropdown}
              searchQuery={mentionQuery}
              tasks={filteredTasks}
              selectedIndex={mentionSelectedIndex}
              onSelect={handleTaskSelect}
              onDismiss={dismissMentionDropdown}
              projectNames={projectNames}
              isLoading={isTasksLoading}
            />

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (@ to link a task)"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-helm-bg border border-helm-border rounded-lg text-helm-text placeholder:text-helm-text-muted focus:border-helm-primary focus:ring-1 focus:ring-helm-primary outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-helm-primary hover:bg-helm-primary-hover text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs text-helm-text-muted mt-2 text-center">
            Press Enter to send, Esc to close, @ to link a task
          </p>
        </div>
      </div>
    </div>
  )
}

// Custom components for ReactMarkdown - defined at module level to avoid recreation on each render
const markdownComponents: Components = {
  // Code blocks with syntax highlighting
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match && !className

    if (isInline) {
      // Inline code: `code`
      return (
        <code
          className="bg-helm-bg px-1.5 py-0.5 rounded text-sm font-mono text-helm-primary"
          {...props}
        >
          {children}
        </code>
      )
    }

    // Code block with syntax highlighting
    return <CodeBlock language={match?.[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
  },
  // Override pre to prevent double-wrapping
  pre({ children }) {
    return <>{children}</>
  },
  // Style links
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-helm-primary hover:underline"
      >
        {children}
      </a>
    )
  },
}

interface MessageBubbleProps {
  message: CopilotMessage
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const hasSuggestions = !isUser && message.suggestions && message.suggestions.length > 0 && message.linkedTaskId
  const hasLinkedTask = isUser && message.linkedTaskTitle

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-slide-up`}>
      {/* Linked task indicator for user messages */}
      {hasLinkedTask && (
        <div className="flex items-center gap-1.5 mb-1 text-xs text-helm-text-muted">
          <CheckSquare size={10} className="text-helm-primary" />
          <span className="truncate max-w-[200px]" title={message.linkedTaskTitle}>
            Re: {message.linkedTaskTitle}
          </span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-helm-primary text-white'
            : 'bg-helm-bg border border-helm-border text-helm-text'
        }`}
      >
        {isUser ? (
          // User messages: plain text
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          // Assistant messages: markdown with syntax highlighting
          <div className="prose prose-helm prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Render SubtaskSuggestions below the message bubble if present */}
      {hasSuggestions && (
        <div className="max-w-[85%] mt-2">
          <SubtaskSuggestions
            suggestions={message.suggestions!}
            parentTaskId={message.linkedTaskId!}
          />
        </div>
      )}
    </div>
  )
}
