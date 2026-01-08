import { useEffect, useRef } from 'react'

// Hook for detecting double-tap Cmd key
export function useDoubleTapCmd(onDoubleTap: () => void) {
  const lastTapRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta' && !e.repeat) {
        const now = Date.now()
        const timeSinceLastTap = now - lastTapRef.current

        if (timeSinceLastTap < 400 && timeSinceLastTap > 50) {
          e.preventDefault()
          onDoubleTap()
          lastTapRef.current = 0
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
        } else {
          lastTapRef.current = now
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(() => {
            lastTapRef.current = 0
          }, 400)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [onDoubleTap])
}
