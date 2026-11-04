// Sound effects, synthesized with the Web Audio API (no audio files to load or license).
// Browsers only allow sound after the visitor interacts with the page, which every
// sound here follows (a swipe, click, or hover).

const MUTE_KEY = 'photomon-muted'
let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<(muted: boolean) => void>()

export const isMuted = () => muted
export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not remembered; still applies for this visit.
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.02)
  listeners.forEach((l) => l(value))
}
export function onMutedChange(listener: (muted: boolean) => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noise
}

function noiseSource(c: AudioContext, loop = false) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  src.loop = loop
  // Start somewhere random so repeated sounds don't sound identical.
  return { src, offset: Math.random() * 1.5 }
}

/** A short pitched tone with a quick attack and exponential decay. */
function tone(
  c: AudioContext,
  out: AudioNode,
  { freq, type = 'sine', at = 0, attack = 0.005, decay = 0.2, gain = 0.2, glideTo }: {
    freq: number
    type?: OscillatorType
    at?: number
    attack?: number
    decay?: number
    gain?: number
    glideTo?: number
  },
) {
  const t = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + decay)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + attack + decay + 0.05)
}

/** Filtered noise burst. */
function burst(
  c: AudioContext,
  out: AudioNode,
  { at = 0, dur, gain, type = 'bandpass', from, to, q = 1, attack = 0.005 }: {
    at?: number
    dur: number
    gain: number
    type?: BiquadFilterType
    from: number
    to?: number
    q?: number
    attack?: number
  },
) {
  const t = c.currentTime + at
  const { src, offset } = noiseSource(c)
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(g).connect(out)
  src.start(t, offset)
  src.stop(t + dur + 0.05)
}

/** Call from the first pointer or key event so later sounds aren't blocked. */
export function unlockAudio() {
  audio()
}

/**
 * Crackly paper-tearing sound while the pack's seam is being pulled.
 * `set(amount)` takes how fast the tear is moving (0 to 1).
 */
export function startTear() {
  const c = audio()
  if (!c || !master) return { set: () => {}, stop: () => {} }
  const { src, offset } = noiseSource(c, true)
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2600
  band.Q.value = 0.9
  const crackle = c.createGain()
  crackle.gain.value = 0
  const level = c.createGain()
  level.gain.value = 0
  src.connect(band).connect(crackle).connect(level).connect(master)
  src.start(0, offset)
  // Paper tears in tiny uneven bursts: jitter the volume and pitch.
  const timer = window.setInterval(() => {
    const t = c.currentTime
    crackle.gain.setTargetAtTime(Math.random() < 0.3 ? 0.05 : 0.2 + Math.random() * 0.8, t, 0.004)
    band.frequency.setTargetAtTime(1800 + Math.random() * 2400, t, 0.01)
  }, 18)
  return {
    set(amount: number) {
      level.gain.setTargetAtTime(Math.max(0, Math.min(1, amount)) * 0.5, c.currentTime, 0.03)
    },
    stop() {
      window.clearInterval(timer)
      level.gain.setTargetAtTime(0, c.currentTime, 0.04)
      src.stop(c.currentTime + 0.3)
    },
  }
}

/** The final rip as the top of the pack tears off: a fast run of tearing crackles, then the strip coming free. */
export function playRip() {
  const c = audio()
  if (!c || !master) return
  for (let i = 0; i < 18; i++) {
    burst(c, master, {
      at: i * 0.016 + Math.random() * 0.008,
      dur: 0.035 + Math.random() * 0.03,
      gain: 0.3 + Math.random() * 0.35,
      from: 1400 + Math.random() * 3200,
      q: 1.2,
      attack: 0.001,
    })
  }
  burst(c, master, { dur: 0.32, gain: 0.32, from: 900, to: 4800, q: 0.6, attack: 0.01 })
  burst(c, master, { at: 0.27, dur: 0.18, gain: 0.18, type: 'highpass', from: 3000, attack: 0.004 })
  tone(c, master, { freq: 130, glideTo: 60, decay: 0.12, gain: 0.18 })
}

/** Cards shooting up out of the pack: three quick rising whooshes. */
export function playWhoosh() {
  const c = audio()
  if (!c || !master) return
  for (let i = 0; i < 3; i++) {
    burst(c, master, { at: i * 0.085, dur: 0.38, gain: 0.45, from: 500, to: 3800, q: 1.6, attack: 0.12 })
  }
  tone(c, master, { freq: 300, glideTo: 900, decay: 0.3, gain: 0.04, type: 'triangle', attack: 0.08 })
}

/** A card landing on the table: a soft papery slap with a little thump. */
export function playLand(at = 0) {
  const c = audio()
  if (!c || !master) return
  burst(c, master, { at, dur: 0.09, gain: 0.35, type: 'lowpass', from: 2400, to: 600, q: 0.5, attack: 0.002 })
  tone(c, master, { at, freq: 170, glideTo: 80, decay: 0.12, gain: 0.22 })
}

/**
 * Hovering a card: a soft, angelic choir-like chord that comes in right away,
 * with a faint airy shimmer on top. The epic card's chord is brighter, with a
 * few slow sparkles. Returns a function that fades it out.
 */
export function startVoid(epic = false): () => void {
  const c = audio()
  if (!c || !master) return () => {}
  const t = c.currentTime
  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, t)
  // Starts right away: just long enough a fade to avoid a click.
  out.gain.exponentialRampToValueAtTime(1, t + 0.04)
  // Rounds off the top so it sounds like voices rather than beeps.
  const soften = c.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = 2400
  soften.connect(out)
  out.connect(master)
  const stops: (() => void)[] = []

  // "Aah" chord: each note is two slightly detuned voices with a slow vibrato.
  const chord = epic ? [523.3, 659.3, 784, 1046.5] : [440, 554.4, 659.3, 880]
  const vibrato = c.createOscillator()
  vibrato.frequency.value = 4.5
  const vibratoDepth = c.createGain()
  vibratoDepth.gain.value = 3
  vibrato.connect(vibratoDepth)
  vibrato.start()
  stops.push(() => vibrato.stop(c.currentTime + 0.6))
  chord.forEach((freq, i) => {
    for (const detune of [-6, 6]) {
      const osc = c.createOscillator()
      osc.type = i === 0 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      osc.detune.value = detune
      vibratoDepth.connect(osc.frequency)
      const g = c.createGain()
      g.gain.value = 0.012 / (1 + i * 0.3)
      osc.connect(g).connect(soften)
      osc.start()
      stops.push(() => osc.stop(c.currentTime + 0.6))
    }
  })

  // Breath of air on top.
  const { src, offset } = noiseSource(c, true)
  const air = c.createBiquadFilter()
  air.type = 'bandpass'
  air.frequency.value = epic ? 6000 : 5000
  air.Q.value = 1.2
  const airGain = c.createGain()
  airGain.gain.value = 0.006
  src.connect(air).connect(airGain).connect(out)
  src.start(0, offset)
  stops.push(() => src.stop(c.currentTime + 0.6))

  let sparkle = 0
  if (epic) {
    const notes = [2093, 2349, 2637, 3136]
    sparkle = window.setInterval(() => {
      tone(c, out, { freq: notes[Math.floor(Math.random() * notes.length)], decay: 0.7, gain: 0.008 })
    }, 420)
  }

  return () => {
    window.clearInterval(sparkle)
    out.gain.cancelScheduledValues(c.currentTime)
    out.gain.setTargetAtTime(0.0001, c.currentTime, 0.12)
    stops.forEach((s) => s())
  }
}

/** Choosing a card: a bright rising arpeggio with a soft whoomp underneath. */
export function playSelect(epic = false) {
  const c = audio()
  if (!c || !master) return
  const notes = epic ? [659, 784, 988, 1319, 1568, 1976] : [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    tone(c, master!, { at: i * 0.055, freq, type: 'triangle', decay: 0.45, gain: 0.14 })
    tone(c, master!, { at: i * 0.055, freq: freq * 2, decay: 0.3, gain: 0.04 })
  })
  tone(c, master, { freq: 140, glideTo: 70, decay: 0.3, gain: 0.25 })
  burst(c, master, { dur: 0.4, gain: 0.08, from: 3000, to: 8000, q: 0.8, attack: 0.02 })
}

/** One beep of the photo countdown. */
export function playTick() {
  const c = audio()
  if (!c || !master) return
  tone(c, master, { freq: 880, type: 'square', decay: 0.1, gain: 0.14 })
  tone(c, master, { freq: 1760, decay: 0.07, gain: 0.08 })
}

/**
 * Camera snap when the photo is taken: the two-part "ka-chik" of a camera
 * shutter (mirror flips up, shutter closes), each a sharp click with a little body.
 */
export function playShutter() {
  const c = audio()
  if (!c || !master) return
  const click = (at: number, pitch: number, gain: number) => {
    // Sharp transient.
    burst(c, master!, { at, dur: 0.018, gain, type: 'highpass', from: 3500, attack: 0.0005 })
    // Bright snap with a short metallic ring.
    burst(c, master!, { at, dur: 0.05, gain: gain * 0.8, from: pitch, q: 4, attack: 0.0008 })
    // Body: a low thunk from the mechanism.
    tone(c, master!, { at, freq: 190, glideTo: 70, attack: 0.001, decay: 0.06, gain: gain * 0.7 })
  }
  click(0, 3200, 0.28)
  click(0.075, 2400, 0.24)
  // Faint mechanical rattle between and after the clicks.
  burst(c, master, { at: 0.01, dur: 0.13, gain: 0.06, from: 1200, q: 2, attack: 0.002 })
}
