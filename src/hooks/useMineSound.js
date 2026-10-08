import { useCallback, useEffect, useRef, useState } from 'react'

function makeNoise(context, duration = 0.08) {
  const length = Math.floor(context.sampleRate * duration)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  return buffer
}

export default function useMineSound() {
  const [enabled, setEnabled] = useState(false)
  const contextRef = useRef(null)
  const ambienceRef = useRef(null)

  const getContext = useCallback(() => {
    if (!contextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return null
      contextRef.current = new AudioContext()
    }
    if (contextRef.current.state === 'suspended') contextRef.current.resume()
    return contextRef.current
  }, [])

  const stopAmbience = useCallback(() => {
    if (!ambienceRef.current) return
    ambienceRef.current.forEach((node) => {
      try {
        node.stop?.()
        node.disconnect?.()
      } catch {
        // Audio nodes may already be stopped.
      }
    })
    ambienceRef.current = null
  }, [])

  const startAmbience = useCallback(() => {
    const context = getContext()
    if (!context || ambienceRef.current) return

    const master = context.createGain()
    const low = context.createOscillator()
    const distant = context.createOscillator()
    const filter = context.createBiquadFilter()

    master.gain.value = 0.025
    low.type = 'sine'
    low.frequency.value = 43
    distant.type = 'triangle'
    distant.frequency.value = 67
    filter.type = 'lowpass'
    filter.frequency.value = 120

    low.connect(filter)
    distant.connect(filter)
    filter.connect(master)
    master.connect(context.destination)
    low.start()
    distant.start()
    ambienceRef.current = [low, distant, filter, master]
  }, [getContext])

  const toggle = useCallback(() => {
    if (enabled) stopAmbience()
    else startAmbience()
    setEnabled(!enabled)
  }, [enabled, startAmbience, stopAmbience])

  const play = useCallback(
    (name) => {
      if (!enabled) return
      const context = getContext()
      if (!context) return
      const now = context.currentTime
      const gain = context.createGain()
      gain.connect(context.destination)

      if (name === 'impact' || name === 'debris') {
        const source = context.createBufferSource()
        const filter = context.createBiquadFilter()
        source.buffer = makeNoise(context, 0.07)
        filter.type = 'bandpass'
        filter.frequency.value = name === 'impact' ? 860 : 310
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
        source.connect(filter)
        filter.connect(gain)
        source.start(now)
        source.stop(now + 0.1)
        return
      }

      const oscillator = context.createOscillator()
      oscillator.connect(gain)
      const settings = {
        discovery: [520, 1040, 0.42, 'square'],
        machine: [72, 46, 0.28, 'sawtooth'],
        explosion: [110, 28, 0.48, 'sawtooth'],
        secret: [230, 460, 0.26, 'triangle'],
      }[name] || [180, 120, 0.12, 'square']
      oscillator.type = settings[3]
      oscillator.frequency.setValueAtTime(settings[0], now)
      oscillator.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2])
      gain.gain.setValueAtTime(name === 'explosion' ? 0.18 : 0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + settings[2])
      oscillator.start(now)
      oscillator.stop(now + settings[2])
    },
    [enabled, getContext],
  )

  useEffect(() => () => {
    stopAmbience()
    contextRef.current?.close()
  }, [stopAmbience])

  return { enabled, toggle, play }
}
