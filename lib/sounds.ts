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

// ── Ambient ocean backing track ─────────────────────────────────────────────
// Continuous low-gain drone that responds to wave intensity. 0 = calm flat
// sea, 1 = tsunami. Intensity ramps smoothly via linearRampToValueAtTime.

interface AmbientNodes {
  rumble: OscillatorNode       // deep ocean rumble
  wind: BiquadFilterNode        // bandpass-filtered noise = "wind/waves"
  noise: AudioBufferSourceNode
  rumbleGain: GainNode
  windGain: GainNode
}
let ambient: AmbientNodes | null = null

export function startAmbient(intensity = 0): void {
  const c = guard()
  if (!c) return
  if (ambient) { updateAmbient(intensity); return }

  // Ocean rumble — very low sine
  const rumble = c.createOscillator()
  rumble.type = 'sine'
  rumble.frequency.value = 55
  const rumbleGain = c.createGain()
  rumbleGain.gain.value = 0.015 + intensity * 0.04

  // White-noise buffer for waves/wind
  const bufSize = c.sampleRate * 2
  const buffer = c.createBuffer(1, bufSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const noise = c.createBufferSource()
  noise.buffer = buffer
  noise.loop = true

  // Band-pass filter shapes noise into wave sounds
  const wind = c.createBiquadFilter()
  wind.type = 'bandpass'
  wind.frequency.value = 300 + intensity * 400  // higher intensity = higher wind pitch
  wind.Q.value = 0.6

  const windGain = c.createGain()
  windGain.gain.value = 0.008 + intensity * 0.05

  rumble.connect(rumbleGain)
  rumbleGain.connect(c.destination)
  noise.connect(wind)
  wind.connect(windGain)
  windGain.connect(c.destination)

  rumble.start()
  noise.start()

  ambient = { rumble, wind, noise, rumbleGain, windGain }
}

export function updateAmbient(intensity: number): void {
  if (!ambient) return
  const c = audioCtx
  if (!c) return
  const now = c.currentTime
  const ramp = 0.8  // smooth 800ms transition
  ambient.rumbleGain.gain.cancelScheduledValues(now)
  ambient.rumbleGain.gain.linearRampToValueAtTime(0.015 + intensity * 0.04, now + ramp)
  ambient.windGain.gain.cancelScheduledValues(now)
  ambient.windGain.gain.linearRampToValueAtTime(0.008 + intensity * 0.05, now + ramp)
  ambient.wind.frequency.cancelScheduledValues(now)
  ambient.wind.frequency.linearRampToValueAtTime(300 + intensity * 400, now + ramp)
}

export function stopAmbient(): void {
  if (!ambient) return
  try {
    ambient.rumble.stop()
    ambient.noise.stop()
  } catch { /* already stopped */ }
  ambient = null
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
