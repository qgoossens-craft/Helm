## Task: Make the AI Copilot Persistent Across Sessions

The AI copilot needs to feel like a real companion that remembers conversations, even after closing and reopening the app. Currently, conversations are saved to SQLite but never loaded back.

### Current State
- Conversations saved to `ai_conversations` table (write-only)
- Messages stored in local useState (lost on panel close)
- No history sent to API (each message is isolated)

### Required Changes

#### 1. Update Zustand Store for Copilot State

Create or update the copilot store to hold messages per project:
```typescript
interface CopilotState {
  messagesByProject: Record<string, Message[]>  // projectId -> messages
  getMessages: (projectId: string) => Message[]
  addMessage: (projectId: string, message: Message) => void
  setMessages: (projectId: string, messages: Message[]) => void
  clearMessages: (projectId: string) => void
}
```

#### 2. Load Conversations from SQLite on Project Open

When the copilot opens for a project, load recent conversations from DB:
```typescript
// On copilot open or project change:
const recentConversations = await db.aiConversations.getByProject(projectId, 30) // last 30 messages

// Transform DB format to Message format:
const messages = recentConversations.flatMap(conv => [
  { role: 'user', content: conv.user_message },
  { role: 'assistant', content: conv.ai_response }
])

// Load into Zustand:
setMessages(projectId, messages)
```

#### 3. Add DB Method to Retrieve Conversations
```typescript
// In your DB service:
aiConversations: {
  getByProject(projectId: string, limit: number = 30) {
    return db.prepare(`
      SELECT user_message, ai_response, created_at
      FROM ai_conversations
      WHERE project_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `).all(projectId, limit)
  }
}
```

Note: ORDER BY ASC so messages are in chronological order.

#### 4. Send Full History to API

Update the askCopilot function to accept and use conversation history:
```typescript
export async function askCopilot(
  message: string,
  projectId: string,
  conversationHistory: Message[]
): Promise<string> {
  
  const systemPrompt = await buildSystemPrompt(projectId)
  
  // Trim history if too long (keep last 20 messages to save tokens)
  const trimmedHistory = conversationHistory.slice(-20)
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ]
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 500,
    temperature: 0.7
  })
  
  const response = completion.choices[0]?.message?.content || 'No response'
  
  // Save to DB (already exists)
  await db.aiConversations.save({ projectId, userMessage: message, aiResponse: response })
  
  return response
}
```

#### 5. Update CopilotModal Component
```typescript
function CopilotModal({ projectId, isOpen }) {
  const { getMessages, addMessage, setMessages } = useCopilotStore()
  const messages = getMessages(projectId)
  const [isLoading, setIsLoading] = useState(false)
  const hasLoadedRef = useRef<string | null>(null)
  
  // Load from DB when project changes or first open
  useEffect(() => {
    if (isOpen && projectId && hasLoadedRef.current !== projectId) {
      loadConversations()
      hasLoadedRef.current = projectId
    }
  }, [isOpen, projectId])
  
  const loadConversations = async () => {
    const conversations = await db.aiConversations.getByProject(projectId, 30)
    const msgs = conversations.flatMap(c => [
      { role: 'user' as const, content: c.user_message },
      { role: 'assistant' as const, content: c.ai_response }
    ])
    setMessages(projectId, msgs)
  }
  
  const handleSend = async (input: string) => {
    addMessage(projectId, { role: 'user', content: input })
    setIsLoading(true)
    
    try {
      const response = await askCopilot(input, projectId, messages)
      addMessage(projectId, { role: 'assistant', content: response })
    } catch (err) {
      // handle error
    } finally {
      setIsLoading(false)
    }
  }
  
  // ... rest of component
}
```

#### 6. Remove the Message Reset

Delete or modify the useEffect that clears messages on panel open:
```typescript
// DELETE THIS:
useEffect(() => {
  if (isCopilotOpen) {
    setMessages([])  // ← REMOVE
  }
}, [isCopilotOpen])
```

#### 7. Add "New Conversation" Button

Let user manually start fresh if they want:
```typescript
const handleNewConversation = async () => {
  clearMessages(projectId)
  // Optionally: mark old conversations in DB as "archived"
}

// In JSX:
<button onClick={handleNewConversation}>Start new conversation</button>
```

### Expected Behavior After Changes

1. User opens Helm, goes to project "QA Strategy"
2. Opens copilot → sees previous conversations loaded from DB
3. Asks "where did we leave off?" → AI knows because history is in the prompt
4. Closes copilot panel → messages stay in Zustand
5. Reopens panel → messages still there (from Zustand)
6. Closes Helm entirely, reopens next day → messages reload from SQLite
7. Clicks "New conversation" → starts fresh

### Testing Checklist

- [ ] Open copilot on a project with existing conversations → should load them
- [ ] Send a follow-up message referencing previous discussion → AI should understand
- [ ] Close panel, reopen → messages still there
- [ ] Switch projects → different conversation history loads
- [ ] Close app, reopen → conversations persist
- [ ] Click "New conversation" → clears and starts fresh
- [ ] Long conversation (30+ messages) → doesn't break, history trimmed for API