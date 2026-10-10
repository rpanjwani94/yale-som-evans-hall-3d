import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Player from './Player.jsx'
import Minimap from './Minimap.jsx'
import TouchControls from './TouchControls.jsx'
import ChatWindow from './ChatWindow.jsx'
import { talk } from './talk.js'
import { EYE, SPAWN } from './layout.js'

export default function App() {
  const [locked, setLocked] = useState(false)
  const [where, setWhere] = useState('')
  const [showMap, setShowMap] = useState(true)
  const lockRef = useRef()
  const mapRef = useRef()
  const onLock = useCallback((v) => setLocked(v), [])
  const onWhere = useCallback((w) => setWhere(w), [])
  // phones have no pointer lock, so they get a joystick + drag-to-look instead
  const [isTouch] = useState(() => matchMedia('(pointer: coarse)').matches) // phones + tablets; touchscreen laptops still get mouse mode
  const [touchOn, setTouchOn] = useState(false)
  const touchRef = useRef({ active: false, move: [0, 0], look: [0, 0], jump: false })
  const setTouch = (on) => {
    touchRef.current.active = on
    touchRef.current.move = [0, 0]
    setTouchOn(on)
  }
  const playing = locked || touchOn

  // chatting with a professor: the mouse is released and the walker stops until the chat closes
  const [chat, setChat] = useState(null) // { id, name, course } of the professor you're talking to
  const [near, setNear] = useState(null)
  const chatFromTouch = useRef(false)
  const onNear = useCallback((id) => setNear(id), [])
  const openChat = useCallback((id) => {
    const t = talk.targets[id]
    if (!t) return
    talk.active = id
    talk.mood = 'listening'
    chatFromTouch.current = touchRef.current.active
    if (touchRef.current.active) setTouch(false)
    setChat({ id, name: t.name, course: t.course })
  }, [])
  const closeChat = useCallback((keepWalking) => {
    talk.active = null
    setChat(null)
    if (chatFromTouch.current) setTouch(true)
    else if (keepWalking) lockRef.current?.() // the close click counts as the gesture pointer lock needs
  }, [])

  useEffect(() => {
    const k = (e) => e.code === 'KeyM' && !e.target.matches?.('input, textarea') && setShowMap((v) => !v)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <>
      <Canvas
        camera={{ fov: 72, near: 0.05, far: 800, position: [SPAWN.x, EYE, SPAWN.z] }}
        dpr={[1, 1.75]}
      >
        <World />
        <Player lockRef={lockRef} mapRef={mapRef} touchRef={touchRef} onLock={onLock} onWhere={onWhere} onTalk={openChat} onNear={onNear} />
      </Canvas>

      <div className="where">
        <span className="dot" />
        {where}
      </div>
      <div className={showMap ? 'mapwrap' : 'mapwrap hidden'}>
        <Minimap drawRef={mapRef} />
      </div>
      <button className="maptoggle" onClick={() => setShowMap((s) => !s)}>
        {showMap ? 'hide map' : 'map'}
      </button>
      {playing && <div className="crosshair" />}
      {touchOn && <TouchControls touchRef={touchRef} onPause={() => setTouch(false)} />}
      {playing && near && !chat && talk.targets[near] && (
        touchOn ? (
          <button className="talkbtn" onClick={() => openChat(near)}>
            Talk to {talk.targets[near].name}
          </button>
        ) : (
          <div className="talkhint">Aim at {talk.targets[near].name} and click to chat</div>
        )
      )}
      {chat && <ChatWindow key={chat.id} prof={chat} onClose={closeChat} />}

      {!playing && !chat && (
        <div className="overlay" onClick={() => (isTouch ? setTouch(true) : lockRef.current?.())}>
          <div className="card">
            <div className="kicker">Yale SOM · Evans Hall</div>
            <h1>Floor 2</h1>
            <p className="sub">Classroom drums, the cloister, Ross Library, the Beinecke Terrace Room, and the courtyard.</p>
            <button className="go">{isTouch ? 'Tap to walk in' : 'Click to walk in'}</button>
            {!isTouch && (
              <button
                className="go alt"
                onClick={(e) => {
                  e.stopPropagation()
                  setTouch(true)
                }}
              >
                Use on-screen joystick
              </button>
            )}
            {isTouch ? (
              <div className="keys">
                <span><b>Left thumb</b> joystick to walk (push all the way to hurry)</span>
                <span><b>Right thumb</b> drag to look</span>
              </div>
            ) : (
              <div className="keys">
                <span><b>W A S D</b> walk</span>
                <span><b>Mouse</b> look</span>
                <span><b>Shift</b> sprint</span>
                <span><b>Space</b> jump</span>
                <span><b>C</b> crouch</span>
                <span><b>M</b> map</span>
                <span><b>Esc</b> pause</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
