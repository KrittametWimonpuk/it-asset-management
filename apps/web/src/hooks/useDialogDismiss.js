import { useEffect, useRef } from 'react'

export function useDialogDismiss(onDismiss, disabled = false, dialogRef = null) {
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
      if (event.key === 'Tab' && dialogRef?.current) {
        const focusable = [...dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        )].filter((element) => !element.hidden)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dialogRef, disabled, onDismiss])
}
