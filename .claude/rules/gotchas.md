# Electron Drag Region Gotcha

- Layout.tsx has a 40px `drag-region` overlay at top of main content (`h-10 drag-region z-10`)
- Any clickable elements within the top 40px of a view will be blocked by the drag region
- Fix: Add `style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}` to clickable elements in that area
- Z-index doesn't help - drag regions capture events regardless of stacking order
