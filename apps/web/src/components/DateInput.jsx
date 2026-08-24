import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import './DateInput.css'

function toDisplay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

function toIso(display) {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, day, month, year] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return ''
  return `${year}-${month}-${day}`
}

function formatTyping(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export default function DateInput({ id, value, onChange, className = '', disabled, required, min, ariaDescribedBy, inputRef }) {
  const [display, setDisplay] = useState(() => toDisplay(value))
  const focused = useRef(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!focused.current) setDisplay(toDisplay(value))
  }, [value])

  function changeText(event) {
    const nextDisplay = formatTyping(event.target.value)
    setDisplay(nextDisplay)
    onChange(toIso(nextDisplay))
  }

  function blurText() {
    focused.current = false
    const iso = toIso(display)
    setDisplay(iso ? toDisplay(iso) : '')
    onChange(iso)
  }

  function pickDate(event) {
    const iso = event.target.value
    setDisplay(toDisplay(iso))
    onChange(iso)
  }

  function openPicker() {
    if (disabled) return
    if (typeof pickerRef.current?.showPicker === 'function') pickerRef.current.showPicker()
    else pickerRef.current?.click()
  }

  return <div className={`date-input-wrap${disabled ? ' is-disabled' : ''}`}>
    <input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/yyyy"
      value={display}
      onFocus={() => { focused.current = true }}
      onChange={changeText}
      onBlur={blurText}
      className={className}
      disabled={disabled}
      required={required}
      aria-describedby={ariaDescribedBy}
    />
    <button type="button" className="date-input-trigger" onClick={openPicker} disabled={disabled} aria-label="เปิดปฏิทิน">
      <CalendarDays size={17} />
    </button>
    <input ref={pickerRef} className="date-input-native" type="date" value={value || ''} min={min} onChange={pickDate} tabIndex="-1" aria-hidden="true" disabled={disabled} />
  </div>
}
