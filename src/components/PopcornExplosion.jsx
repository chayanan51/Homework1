import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const KERNEL_SRC = '/kettle-corn-cursor-64.png'

function burstParticles() {
  return Array.from({ length: 24 }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    angle: (360 / 24) * i + Math.random() * 20,
    distance: 60 + Math.random() * 130,
    size: 14 + Math.random() * 16,
    spin: -180 + Math.random() * 360,
    delay: Math.random() * 0.1,
  }))
}

export default function PopcornExplosion({ origin, onDone }) {
  const [particles] = useState(burstParticles)

  useEffect(() => {
    const timer = window.setTimeout(onDone, 950)
    return () => window.clearTimeout(timer)
  }, [onDone])

  if (!origin) return null

  return createPortal(
    <div
      className="popcorn-burst-layer"
      style={{ left: origin.x, top: origin.y }}
      aria-hidden="true"
    >
      <img src={KERNEL_SRC} alt="" className="popcorn-burst-core" draggable={false} />
      {particles.map((p) => (
        <img
          key={p.id}
          src={KERNEL_SRC}
          alt=""
          className="popcorn-particle"
          draggable={false}
          style={{
            '--angle': `${p.angle}deg`,
            '--distance': `${p.distance}px`,
            '--size': `${p.size}px`,
            '--spin': `${p.spin}deg`,
            '--delay': `${p.delay}s`,
          }}
        />
      ))}
    </div>,
    document.body,
  )
}
