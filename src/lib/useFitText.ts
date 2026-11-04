import { useLayoutEffect, useRef } from 'react'

/**
 * Shrinks an element's font size (down to `min` px) until its text fits:
 * width for single-line text, height for wrapping text.
 */
export function useFitText<T extends HTMLElement>(text: string, max: number, min: number, axis: 'width' | 'height') {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let size = max
    el.style.fontSize = `${size}px`
    const overflowing = () =>
      axis === 'width' ? el.scrollWidth > el.clientWidth + 0.5 : el.scrollHeight > el.clientHeight + 0.5
    while (size > min && overflowing()) {
      size -= 0.5
      el.style.fontSize = `${size}px`
    }
  }, [text, max, min, axis])
  return ref
}
