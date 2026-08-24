import { useEffect, useRef } from 'react'

export function useDialogDismiss(onDismiss, disabled = false) {
  const previousFocus = useRef(null)

  useEffect(() => {
    previousFocus.current = document.activeElement
    return () => {
      const target = previousFocus.current
      if (target instanceof HTMLElement) requestAnimationFrame(() => target.focus())
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !disabled) onDismiss?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [disabled, onDismiss])
}
