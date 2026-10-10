import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { talk } from './talk.js'

// Prof. Zaman, built from primitives in meters (1.75 m tall): black BLACKPINK hoodie, jeans, sneakers,
// nerd glasses, and a pink Labubu hanging off his belt loop. Figure faces +z; his right hand is at -x.
// While his chat window is open he turns to face you, puts a hand to his chin while thinking, and talks with his hands.

const SKIN = '#c68e64' // light brown
const HAIR = '#141010'
const HOODIE = '#141418'
const PINK = '#ff4fa3'
const JEANS = '#2a3a5c'

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const TORUS = new THREE.TorusGeometry(1, 0.14, 8, 24)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const TORSO = new THREE.CylinderGeometry(0.2, 0.215, 0.56, 28)

const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

function printTex() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = HOODIE
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = PINK
  g.font = 'bold 76px system-ui, -apple-system, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('BLACKPINK', 256, 68)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k

export default function Zaman({ position = [0, 0, 0], rotation = 0, phase = 0 }) {
  const root = useRef()
  const head = useRef()
  const mouth = useRef()
  const armR = useRef()
  const armL = useRef()
  const charm = useRef()
  const print = useMemo(() => new THREE.MeshBasicMaterial({ map: printTex() }), [])

  useEffect(() => {
    talk.targets.zaman = { object: root.current, name: 'Prof. Zaman', course: 'MGT 409 · AI Foundations for Managers' }
    return () => delete talk.targets.zaman
  }, [])

  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime + phase
    const r = root.current
    const chatting = talk.active === 'zaman'
    const mood = chatting ? (talk.mood === 'talking' && performance.now() > talk.moodUntil ? 'listening' : talk.mood) : 'idle'
    const k = Math.min(1, dt * 5)

    // body: scan the room while teaching, turn to face you while you chat
    let yaw = rotation + Math.sin(t * 0.4) * 0.35
    let pitch = 0
    if (chatting) {
      const dx = camera.position.x - r.position.x
      const dz = camera.position.z - r.position.z
      yaw = Math.atan2(dx, dz)
      const headY = r.position.y + 1.62
      pitch = -Math.atan2(camera.position.y - headY, Math.hypot(dx, dz)) // look up at you on the risers
    }
    r.rotation.y = lerpAngle(r.rotation.y, yaw, k)

    // head: nod while listening, tilt while thinking
    const h = head.current
    const nod = mood === 'listening' ? Math.sin(t * 2.2) * 0.05 : mood === 'talking' ? Math.sin(t * 5) * 0.04 : 0
    h.rotation.x += (Math.max(-0.5, Math.min(0.5, pitch)) + nod - h.rotation.x) * k
    h.rotation.z += ((mood === 'thinking' ? 0.18 : 0) - h.rotation.z) * k

    // mouth flaps while he talks
    mouth.current.scale.y = mood === 'talking' ? 0.008 + Math.abs(Math.sin(t * 14)) * 0.02 : 0.008

    // right arm: hand to chin while thinking, gestures while talking, relaxed otherwise
    const ar = armR.current
    const [rx, rz] =
      mood === 'thinking' ? [-2.3, 0.75] : mood === 'talking' ? [-0.9 - Math.max(0, Math.sin(t * 3)) * 0.6, -0.2] : [0.05, -0.12]
    ar.rotation.x += (rx - ar.rotation.x) * k
    ar.rotation.z += (rz - ar.rotation.z) * k
    armL.current.rotation.x = mood === 'talking' ? -0.3 + Math.sin(t * 3 + 1.5) * 0.25 : 0.05

    // the Labubu swings from his belt loop
    charm.current.rotation.z = Math.sin(t * 2.3) * 0.18
    charm.current.rotation.x = Math.sin(t * 1.7) * 0.1
  })

  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      {/* sneakers */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={BOX} c="#f4f4f6" p={[0.1 * sx, 0.05, 0.04]} s={[0.11, 0.09, 0.27]} />
          <B g={BOX} c={PINK} p={[0.1 * sx, 0.012, 0.04]} s={[0.115, 0.024, 0.275]} />
        </group>
      ))}
      {/* jeans + belt */}
      {[-1, 1].map((sx) => (
        <B key={sx} g={CYL} c={JEANS} p={[0.1 * sx, 0.5, 0]} s={[0.078, 0.82, 0.078]} />
      ))}
      <B g={CYL} c={JEANS} p={[0, 0.9, 0]} s={[0.2, 0.12, 0.145]} />
      <B g={CYL} c="#1c1c1c" p={[0, 0.955, 0]} s={[0.203, 0.035, 0.148]} />

      {/* Labubu on a little chain from the left belt loop */}
      <group ref={charm} position={[0.19, 0.93, 0.07]}>
        <B g={CYL} c="#c9c9cf" o={{ metalness: 0.9, roughness: 0.3 }} p={[0, -0.04, 0]} s={[0.006, 0.08, 0.006]} />
        <Labubu fur="#ff8fc7" expression="mischief" shirt="#141418" height={0.2} position={[0, -0.29, 0]} />
      </group>

      {/* hoodie */}
      <mesh geometry={TORSO} material={m(HOODIE)} position={[0, 1.18, 0]} scale={[1, 1, 0.72]} />
      <B g={CYL} c={PINK} p={[0, 0.915, 0]} s={[0.218, 0.04, 0.157]} />
      <B c={HOODIE} p={[0, 1.44, 0]} s={[0.25, 0.08, 0.15]} />
      <mesh geometry={new THREE.PlaneGeometry(0.3, 0.075)} material={print} position={[0, 1.27, 0.152]} />
      <B g={BOX} c="#1d1d23" p={[0, 1.02, 0.152]} s={[0.24, 0.12, 0.01]} />
      {/* hood resting on his back + drawstrings */}
      <B c={HOODIE} p={[0, 1.45, -0.12]} s={[0.17, 0.11, 0.09]} />
      {[-1, 1].map((sx) => (
        <B key={sx} g={CYL} c={PINK} p={[0.04 * sx, 1.33, 0.15]} s={[0.006, 0.15, 0.006]} />
      ))}
      <B g={CYL} c={SKIN} p={[0, 1.5, 0]} s={[0.05, 0.08, 0.05]} />

      {/* arms in hoodie sleeves; right arm (at -x) does the gesturing */}
      <group ref={armL} position={[0.25, 1.42, 0]} rotation={[0.05, 0, 0.12]}>
        <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.26, 0]} scale={[0.065, 0.21, 0.065]} />
        <B g={CYL} c={PINK} p={[0, -0.52, 0]} s={[0.058, 0.03, 0.058]} />
        <B c={SKIN} p={[0, -0.57, 0.01]} s={[0.045, 0.055, 0.04]} />
      </group>
      <group ref={armR} position={[-0.25, 1.42, 0]}>
        <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.26, 0]} scale={[0.065, 0.21, 0.065]} />
        <B g={CYL} c={PINK} p={[0, -0.52, 0]} s={[0.058, 0.03, 0.058]} />
        <B c={SKIN} p={[0, -0.57, 0.01]} s={[0.045, 0.055, 0.04]} />
      </group>

      {/* head pivots at the neck */}
      <group ref={head} position={[0, 1.52, 0]}>
        <group position={[0, -1.52, 0]}>
          <B c={SKIN} p={[0, 1.63, 0]} s={[0.11, 0.13, 0.12]} />
          {[-1, 1].map((sx) => (
            <B key={sx} c={SKIN} p={[0.112 * sx, 1.63, 0]} s={[0.02, 0.034, 0.02]} />
          ))}
          {/* short black hair */}
          <B c={HAIR} p={[0, 1.695, -0.012]} s={[0.117, 0.078, 0.124]} />
          <B g={BOX} c={HAIR} p={[0.02, 1.735, 0.085]} r={[0.35, 0, -0.12]} s={[0.15, 0.035, 0.06]} />
          {/* eyes behind black nerd glasses */}
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c="#ffffff" p={[0.042 * sx, 1.645, 0.103]} s={[0.019, 0.015, 0.01]} />
              <B c="#1d1410" p={[0.042 * sx, 1.645, 0.112]} s={[0.01, 0.011, 0.006]} />
              <B g={TORUS} c="#0d0d0f" p={[0.042 * sx, 1.645, 0.118]} s={[0.032, 0.026, 0.03]} />
              <B g={BOX} c="#0d0d0f" p={[0.09 * sx, 1.65, 0.07]} s={[0.006, 0.006, 0.09]} />
              <B g={BOX} c={HAIR} p={[0.043 * sx, 1.683, 0.108]} r={[0, 0, -0.08 * sx]} s={[0.04, 0.009, 0.01]} />
            </group>
          ))}
          <B g={BOX} c="#0d0d0f" p={[0, 1.65, 0.12]} s={[0.022, 0.006, 0.006]} />
          <B c={SKIN} p={[0, 1.61, 0.118]} s={[0.02, 0.026, 0.022]} />
          <mesh ref={mouth} geometry={BOX} material={m('#6b2f2a')} position={[0, 1.572, 0.108]} scale={[0.05, 0.008, 0.008]} />
        </group>
      </group>
    </group>
  )
}
