/**
 * Ocean-themed sound effects via Web Audio API — pure synthesis, zero
 * asset files. Respects a localStorage "sound_enabled" preference so
 * users can mute (default: muted for judges demoing in public).
 */

let audioCtx: AudioContext | null = null
const STORAGE_KEY = 'tw_sound_enabled'

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
    } catch { return null }
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  if (enabled) ctx() // prime the audio context on enable
}

function guard(): AudioContext | null {
  if (!isSoundEnabled()) return null
  return ctx()
}

/** Bubble pop — used for opening a position. Pitch varies by side. */
export function playBubble(side: 'long' | 'short' = 'long') {
  const c = guard()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  const startFreq = side === 'long' ? 700 : 450
  const endFreq = side === 'long' ? 1100 : 280
  osc.frequency.setValueAtTime(startFreq, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + 0.15)
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25)
  osc.start()
  osc.stop(c.currentTime + 0.3)
}

/** Winning close — ascending triad (I-III-V, C major-ish) */
export function playChime() {
  const c = guard()
  if (!c) return
  const notes = [523.25, 659.25, 783.99] // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'triangle'
    osc.frequency.value = freq
    const start = c.currentTime + i * 0.08
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4)
    osc.start(start)
    osc.stop(start + 0.45)
  })
}

/** Losing close — descending minor interval (thud) */
export function playThud() {
  const c = guard()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.3)
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.15, c.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35)
  osc.start()
  osc.stop(c.currentTime + 0.4)
}

/** Splash — white-noise burst for achievement unlocks */
export function playSplash() {
  const c = guard()
  if (!c) return
  const bufferSize = c.sampleRate * 0.3
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    // Decaying white noise
    const decay = 1 - i / bufferSize
    data[i] = (Math.random() * 2 - 1) * decay * decay
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  // High-pass filter to make it more "splash"-like
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2500
  filter.Q.value = 0.7
  const gain = c.createGain()
  gain.gain.value = 0.08
  src.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  src.start()
}

/** Distant whale call — used for big wins / competition end */
export function playWhale() {
  const c = guard()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  // LFO for wobble
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfoGain.gain.value = 20
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  lfo.frequency.value = 3
  osc.frequency.value = 180
  osc.frequency.exponentialRampToValueAtTime(150, c.currentTime + 1.0)
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.15)
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2)
  osc.start()
  lfo.start()
  osc.stop(c.currentTime + 1.3)
  lfo.stop(c.currentTime + 1.3)
}
