import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { EYE, MAX_STEP, SPAWN, collide, floorAt, locate } from './layout.js'
import { TALK_RANGE, talk } from './talk.js'

const CROUCH_EYE = 1.05
const JUMP_SPEED = 4.2
const GRAVITY = 12
const LOOK_SPEED = 0.005 // radians per touch pixel
const typing = (e) => e.target instanceof HTMLElement && e.target.matches('input, textarea')

// PC controls work like a shooter: WASD move, mouse look, Shift sprint, Space jump, C crouch.
// Touch controls come in through touchRef: { active, move: [x, y], look: [dx, dy], jump }.
// Clicking a professor under the crosshair (talk.targets) releases the mouse and calls onTalk(id);
// onNear(id | null) reports the professor in range so phones can show a talk button.
export default function Player({ lockRef, mapRef, touchRef, onLock, onWhere, onTalk, onNear }) {
  const { camera, gl, scene } = useThree()
  const controls = useMemo(() => new PointerLockControls(camera, gl.domElement), [camera, gl])
  const keys = useRef({})
  const where = useRef('')
  const eye = useRef(EYE)
  const floorY = useRef(0)
  const devY = useRef(null) // dev teleport can pin the camera height
  const jumpY = useRef(0)
  const vy = useRef(0)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const ray = useMemo(() => new THREE.Raycaster(undefined, undefined, 0, TALK_RANGE), [])
  const near = useRef(null)

  useEffect(() => {
    camera.position.set(SPAWN.x, EYE, SPAWN.z)
    camera.rotation.set(0, 0, 0)
    lockRef.current = () => controls.lock()
    const on = () => onLock(true)
    const off = () => {
      keys.current = {} // keys held during Esc never get a keyup
      onLock(false)
    }
    controls.addEventListener('lock', on)
    controls.addEventListener('unlock', off)
    const down = (e) => {
      if (typing(e)) return // the chat box gets the keys, not the walker
      keys.current[e.code] = true
      if (e.code === 'Space') e.preventDefault()
    }
    const up = (e) => (keys.current[e.code] = false)
    const blur = () => (keys.current = {})
    // click a professor under the crosshair to talk
    const click = () => {
      if (!controls.isLocked) return
      ray.setFromCamera(new THREE.Vector2(0, 0), camera)
      // the first thing under the crosshair has to be part of a professor (no talking through walls)
      for (let o = ray.intersectObject(scene, true)[0]?.object; o; o = o.parent) {
        const id = Object.keys(talk.targets).find((k) => talk.targets[k].object === o)
        if (id) {
          keys.current = {}
          controls.unlock()
          onTalk(id)
          return
        }
      }
    }
    document.addEventListener('mousedown', click)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      controls.removeEventListener('lock', on)
      controls.removeEventListener('unlock', off)
      controls.dispose()
      document.removeEventListener('mousedown', click)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [camera, controls, lockRef, onLock, onTalk, ray, scene])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    // dev only: teleport for screenshots by setting <body data-go="[x, z, yawDeg]">
    if (import.meta.env.DEV && document.body.dataset.go) {
      const [x, z, yaw, pitch = 0, y = null] = JSON.parse(document.body.dataset.go)
      devY.current = y
      delete document.body.dataset.go
      camera.position.set(x, EYE, z)
      camera.rotation.set(pitch, (yaw * Math.PI) / 180, 0, 'YXZ')
      floorY.current = floorAt(x, z)
    }
    const touch = touchRef.current
    const active = controls.isLocked || touch.active

    // touch look: drag on the right side of the screen
    if (touch.active && (touch.look[0] || touch.look[1])) {
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= touch.look[0] * LOOK_SPEED
      euler.x = Math.max(-1.45, Math.min(1.45, euler.x - touch.look[1] * LOOK_SPEED))
      camera.quaternion.setFromEuler(euler)
    }
    touch.look[0] = 0
    touch.look[1] = 0

    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()

    const k = keys.current
    let f = 0
    let s = 0
    let sprint = false
    if (active) {
      f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
      s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
      sprint = k.ShiftLeft || k.ShiftRight
    }
    if (touch.active && (touch.move[0] || touch.move[1])) {
      f = -touch.move[1]
      s = touch.move[0]
      sprint = Math.hypot(f, s) > 0.95 // push the stick all the way to hurry
    }
    let mx = fwd.x * f - fwd.z * s
    let mz = fwd.z * f + fwd.x * s
    const l = Math.hypot(mx, mz)
    if (l > 0.05) {
      if (l > 1) {
        mx /= l
        mz /= l
      }
      const crouching = active && k.KeyC
      const speed = crouching ? 2.4 : sprint ? 9.5 : 5.5 // m/s; brisk walk, sprint is a jog
      const pos = { x: camera.position.x + mx * speed * dt, z: camera.position.z + mz * speed * dt }
      collide(pos)
      // risers: walk up one step at a time; anything taller acts like a wall
      const cur = floorAt(camera.position.x, camera.position.z)
      if (floorAt(pos.x, pos.z) - cur <= MAX_STEP) {
        camera.position.x = pos.x
        camera.position.z = pos.z
      } else if (floorAt(pos.x, camera.position.z) - cur <= MAX_STEP) {
        camera.position.x = pos.x // slide along the edge
      } else if (floorAt(camera.position.x, pos.z) - cur <= MAX_STEP) {
        camera.position.z = pos.z
      }
    }

    // jump + crouch
    const wantJump = (active && k.Space) || touch.jump
    touch.jump = false
    if (active && wantJump && jumpY.current === 0) vy.current = JUMP_SPEED
    vy.current -= GRAVITY * dt
    jumpY.current = Math.max(0, jumpY.current + vy.current * dt)
    if (jumpY.current === 0) vy.current = 0
    const eyeTarget = active && k.KeyC ? CROUCH_EYE : EYE
    eye.current += (eyeTarget - eye.current) * Math.min(1, dt * 12)
    const fy = floorAt(camera.position.x, camera.position.z)
    floorY.current += (fy - floorY.current) * Math.min(1, dt * 14) // smooth step up/down
    camera.position.y = devY.current ?? floorY.current + eye.current + jumpY.current

    if (import.meta.env.DEV) document.body.dataset.pos = `${camera.position.x.toFixed(2)},${camera.position.z.toFixed(2)},${fwd.x.toFixed(2)},${fwd.z.toFixed(2)}|${touch.move.map((v) => v.toFixed(2))}`
    mapRef.current?.(camera.position.x, camera.position.z, fwd.x, fwd.z)
    let n = null
    for (const [id, t] of Object.entries(talk.targets)) {
      const p = t.object?.position
      if (p && Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < TALK_RANGE) n = id
    }
    if (n !== near.current) {
      near.current = n
      onNear(n)
    }
    const w = locate(camera.position.x, camera.position.z)
    if (w !== where.current) {
      where.current = w
      onWhere(w)
    }
  })
  return null
}
