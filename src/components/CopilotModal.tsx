import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, Sparkles, RotateCcw } from 'lucide-react'
import { useUIStore, useProjectsStore, useCopilotStore, useQuickTodosStore } from '../store'
import type { ConversationMessage } from '../types/global'

export function CopilotModal() {
  const { isCopilotOpen, copilotContext, closeCopilot } = useUIStore()
  const { projects } = useProjectsStore()
  const { todos } = useQuickTodosStore()
  const { messages, addMessage, clearMessages, setContext } = useCopilotStore()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  if (!isCopilotOpen) return null

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userContent = input.trim()

    // Add user message to store
    addMessage({ role: 'user', content: userContent })
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      // Pass conversation history to API
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const { response } = await window.api.copilot.chat(
        userContent,
        copilotContext?.projectId,
        copilotContext?.taskId,
        copilotContext?.quickTodoId,
        conversationHistory
      )

      // Add assistant response to store
      addMessage({ role: 'assistant', content: response })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
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
          <p className="text-xs text-helm-text-muted mt-2 text-center">
            Press Enter to send, Esc to close
          </p>
        </div>
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: ConversationMessage
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-helm-primary text-white'
            : 'bg-helm-bg border border-helm-border text-helm-text'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}
