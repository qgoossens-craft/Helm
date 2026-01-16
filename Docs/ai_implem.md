# Helm — AI Conversation Memory Fix

## Problem

The AI copilot currently has no memory within a session:
1. Only 1 user message is sent per API call (no conversation history)
2. Messages reset every time the copilot panel is opened/closed
3. Saved conversations in DB are never retrieved

This makes the AI feel disconnected and unable to follow a train of thought.

## Goal

Make the AI remember the conversation within a session, so it can:
- Reference what was just discussed
- Build on previous answers
- Feel like an actual copilot, not a reset chatbot

---

## Fix 1: Send Conversation History to API

### Current Code (ai.ts ~line 176-184)

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }  // Only current message
  ],
  max_tokens: 500,
  temperature: 0.7
})
```

### Required Changes

#### Step 1: Update the AI service function signature

The `askCopilot` function (or whatever it's called) needs to accept conversation history as a parameter.

```typescript
// ai.ts

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function askCopilot(
  message: string,
  projectId?: string,
  taskId?: string,
  conversationHistory: ConversationMessage[] = []  // NEW PARAMETER
): Promise<string> {
  
  const systemPrompt = await buildSystemPrompt(projectId, taskId)
  
  // Build messages array with full history
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,  // All previous exchanges
    { role: 'user', content: message }  // Current message
  ]
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 500,
    temperature: 0.7
  })
  
  const response = completion.choices[0]?.message?.content || 'No response'
  
  // Save to DB (keep existing logic)
  await db.aiConversations.save({
    projectId,
    taskId,
    userMessage: message,
    aiResponse: response
  })
  
  return response
}
```

#### Step 2: Update CopilotModal to pass history

```typescript
// CopilotModal.tsx

const handleSendMessage = async () => {
  if (!input.trim()) return
  
  const userMessage = input.trim()
  setInput('')
  setIsLoading(true)
  
  // Add user message to local state
  const newUserMessage: Message = { role: 'user', content: userMessage }
  setMessages(prev => [...prev, newUserMessage])
  
  try {
    // Convert current messages to the format expected by API
    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))
    
    // Pass history to AI service
    const response = await askCopilot(
      userMessage,
      currentProjectId,
      currentTaskId,
      conversationHistory  // NOW INCLUDES HISTORY
    )
    
    // Add assistant response to local state
    const assistantMessage: Message = { role: 'assistant', content: response }
    setMessages(prev => [...prev, assistantMessage])
    
  } catch (error) {
    setError('Failed to get response')
  } finally {
    setIsLoading(false)
  }
}
```

#### Step 3: Limit history size to avoid token overflow

Add a utility to trim history if it gets too long:

```typescript
// ai.ts

const MAX_HISTORY_MESSAGES = 20  // Keep last 20 messages (10 exchanges)

function trimHistory(history: ConversationMessage[]): ConversationMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history
  }
  // Keep the most recent messages
  return history.slice(-MAX_HISTORY_MESSAGES)
}

// Use in askCopilot:
const messages: ChatCompletionMessageParam[] = [
  { role: 'system', content: systemPrompt },
  ...trimHistory(conversationHistory),
  { role: 'user', content: message }
]
```

---

## Fix 2: Persist Messages Across Panel Open/Close

### Current Code (CopilotModal.tsx ~line 42-47)

```typescript
useEffect(() => {
  if (isCopilotOpen) {
    setMessages([])  // Destroys all history
    setError(null)
  }
}, [isCopilotOpen])
```

### Option A: Simple Fix (Keep Local State, Don't Reset)

Just remove the reset:

```typescript
useEffect(() => {
  if (isCopilotOpen) {
    // Don't reset messages anymore
    setError(null)
  }
}, [isCopilotOpen])
```

Add a manual "Clear conversation" button instead:

```typescript
const handleClearConversation = () => {
  setMessages([])
}

// In JSX:
<button onClick={handleClearConversation}>Clear conversation</button>
```

### Option B: Better Fix (Move State to Zustand)

This ensures messages survive even if the component unmounts.

#### Step 1: Add to your Zustand store

```typescript
// store/copilotStore.ts (new file or add to existing store)

import { create } from 'zustand'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface CopilotState {
  messages: Message[]
  addMessage: (message: Message) => void
  clearMessages: () => void
}

export const useCopilotStore = create<CopilotState>((set) => ({
  messages: [],
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  clearMessages: () => set({ messages: [] })
}))
```

#### Step 2: Update CopilotModal to use store

```typescript
// CopilotModal.tsx

import { useCopilotStore } from '../store/copilotStore'

export function CopilotModal({ ... }) {
  // Replace local state with store
  const { messages, addMessage, clearMessages } = useCopilotStore()
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Remove the useEffect that was resetting messages
  
  const handleSendMessage = async () => {
    if (!input.trim()) return
    
    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    
    // Add to store instead of local state
    addMessage({ role: 'user', content: userMessage })
    
    try {
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
      
      const response = await askCopilot(
        userMessage,
        currentProjectId,
        currentTaskId,
        conversationHistory
      )
      
      // Add response to store
      addMessage({ role: 'assistant', content: response })
      
    } catch (error) {
      setError('Failed to get response')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    // ... existing JSX
    // Add clear button somewhere:
    <button onClick={clearMessages}>New conversation</button>
  )
}
```

#### Step 3: Optional - Clear on project change

If user switches to a different project, you might want to clear:

```typescript
// CopilotModal.tsx

const previousProjectId = useRef(currentProjectId)

useEffect(() => {
  if (currentProjectId !== previousProjectId.current) {
    clearMessages()  // New project = new conversation
    previousProjectId.current = currentProjectId
  }
}, [currentProjectId, clearMessages])
```

---

## Fix 3 (Optional): Load Recent Conversations on Session Start

If you want the AI to "remember" previous sessions:

```typescript
// ai.ts - in buildSystemPrompt()

async function buildSystemPrompt(projectId?: string, taskId?: string): Promise<string> {
  // ... existing context building ...
  
  // Add recent conversations from previous sessions
  let recentConversationsContext = ''
  if (projectId) {
    const recentConvos = await db.aiConversations.getRecent(projectId, 5)
    if (recentConvos.length > 0) {
      recentConversationsContext = `
## Recent conversations about this project:
${recentConvos.map(c => `User asked: "${c.user_message.substring(0, 100)}..."
You answered: "${c.ai_response.substring(0, 150)}..."`).join('\n\n')}
`
    }
  }
  
  return `
${baseSystemPrompt}

${contextSection}

${recentConversationsContext}
`
}
```

You'll need to add a `getRecent` method to your DB service:

```typescript
// db.ts or wherever your DB methods are

aiConversations: {
  // ... existing methods ...
  
  getRecent(projectId: string, limit: number = 5) {
    return db.prepare(`
      SELECT user_message, ai_response, created_at
      FROM ai_conversations
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(projectId, limit)
  }
}
```

---

## Testing Checklist

After implementing, verify:

- [ ] Send a message, then a follow-up that references the first → AI should understand context
- [ ] Close copilot panel, reopen → Previous messages should still be there
- [ ] Switch projects → Conversation should reset
- [ ] Have a long conversation (20+ messages) → Should not crash (history trimming works)
- [ ] Click "New conversation" button → Should clear and start fresh

---

## Summary

| Fix | Effort | Impact |
|-----|--------|--------|
| Fix 1: Send history to API | 30 min | Critical - makes AI actually useful |
| Fix 2: Don't reset on panel close | 15 min | High - removes frustration |
| Fix 3: Load past conversations | 30 min | Medium - nice continuity between sessions |

Start with Fix 1 and 2. They're quick and will transform the experience.