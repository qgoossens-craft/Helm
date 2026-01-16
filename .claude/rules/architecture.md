# Helm Architecture

## Database Migrations
- Add new columns via `runMigrations()` in `electron/database/db.ts`
- Check if column exists before adding: `if (!columns.includes('field_name'))`
- Add index for frequently queried combinations

## IPC Pattern
- Database methods in `electron/database/db.ts`
- IPC handlers in `electron/main/index.ts`
- API exposed via `electron/preload/index.ts`
- Types in both preload and `src/types/global.d.ts`

## State Management
- Zustand stores in `src/store/`
- Pattern: fetch from window.api, then `set()` state
- Always add to both interface and implementation

## UI Patterns
- Components follow PrioritySelector dropdown pattern
- Use helm-* Tailwind classes (helm-bg, helm-text, helm-primary, etc.)
- Click-outside detection via useRef + useEffect
