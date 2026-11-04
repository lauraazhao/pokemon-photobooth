import { useEffect, useState } from 'react'
import { isMuted, onMutedChange, setMuted } from '../lib/sfx'

/** Speaker button in the top-right corner that turns the sound effects on or off. */
export default function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMutedChange(setMutedState), [])
  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={() => setMuted(!muted)}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M17 9l5 6M22 9l-5 6" />
        ) : (
          <>
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </>
        )}
      </svg>
    </button>
  )
}
