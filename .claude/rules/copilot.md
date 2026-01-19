# Copilot Store Patterns

- `clearMessages()` should only clear messages, not other state like `linkedTask`
- When opening Copilot with pre-set state (like linked task), ensure `setContext()` doesn't reset it
- Modal close effect should handle cleanup of UI state separately from message clearing

# Jeeves AI Context

- Project documents are loaded via `db.documents.getByProject(projectId)` in `buildContext()`
- Document content is included in `attachedDocuments` array (up to 5 docs, 2000 chars each)
- Context priority: Quick Todo > Task > Project (first with documents wins)
- Documents must have `processing_status === 'completed'` to be included
