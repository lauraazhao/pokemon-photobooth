import { useLayoutEffect, type RefObject } from 'react'

interface Props {
  value: string
  onChange?: (value: string) => void
  editable: boolean
  maxLength: number
  multiline: boolean
  label: string
  className: string
  elRef: RefObject<HTMLParagraphElement | null>
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/**
 * Text on the card that can be edited in place (tap/click and type).
 * The DOM owns the text while typing, so React never resets the caret.
 */
export default function EditableText({ value, onChange, editable, maxLength, multiline, label, className, elRef }: Props) {
  useLayoutEffect(() => {
    const el = elRef.current
    if (el && el.textContent !== value) el.textContent = value
  }, [value, elRef])

  return (
    <p
      ref={elRef}
      className={className}
      contentEditable={editable ? 'plaintext-only' : false}
      suppressContentEditableWarning
      spellCheck={false}
      role={editable ? 'textbox' : undefined}
      aria-label={editable ? label : undefined}
      aria-multiline={editable ? multiline : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && !multiline)) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onInput={(e) => {
        const el = e.currentTarget
        // textContent keeps the real letters (innerText would apply the CSS
        // uppercase); innerText is only needed to turn line breaks into "\n".
        const raw = multiline ? el.innerText : (el.textContent ?? '')
        let text = raw.replace(/\r/g, '')
        if (!multiline) text = text.replace(/\n/g, ' ')
        if (text.length > maxLength) text = text.slice(0, maxLength)
        if (text !== raw) {
          el.textContent = text
          placeCaretAtEnd(el)
        }
        onChange?.(text)
      }}
    />
  )
}
