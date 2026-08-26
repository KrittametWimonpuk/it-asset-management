import { useEffect, useRef } from 'react'

function focusableElements(dialog) {
  return [...dialog.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getClientRects().length > 0)
}

function resolveDialog(dialogRef) {
  if (dialogRef?.current) return dialogRef.current
  const dialogs = [...document.querySelectorAll('[aria-modal="true"][role="dialog"], [aria-modal="true"][role="alertdialog"]')]
  return dialogs.at(-1) || null
}

export function useDialogDismiss(onDismiss, disabled = false, dialogRef = null) {
  const previousFocus = useRef(null)

  useEffect(() => {
    previousFocus.current = document.activeElement
    const frame = requestAnimationFrame(() => {
      const dialog = resolveDialog(dialogRef)
      if (!dialog || dialog.contains(document.activeElement)) return
      const target = dialog.querySelector('[autofocus]') || focusableElements(dialog)[0] || dialog
      if (target === dialog && !dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1')
      target.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
      const target = previousFocus.current
      if (target instanceof HTMLElement) requestAnimationFrame(() => target.focus())
    }
  }, [dialogRef])

  useEffect(() => {
    function handleKeyDown(event) {
      const dialog = resolveDialog(dialogRef)
      if (!dialog) return
      if (event.key === 'Escape' && !disabled) {
        event.preventDefault()
        onDismiss?.()
      }
      if (event.key === 'Tab') {
        const focusable = focusableElements(dialog)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dialogRef, disabled, onDismiss])
}
