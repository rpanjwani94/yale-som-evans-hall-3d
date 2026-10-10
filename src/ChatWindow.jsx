import { useEffect, useRef, useState } from 'react'
import { API, talk } from './talk.js'

const GREETINGS = {
  zaman: "Yo! Welcome to MGT 409. Ask me anything: stats, regression, the central limit theorem, AI agents, or what other classes are running in Evans this fall.",
}

// Chat with one professor. The backend keeps the conversation per session_id, so each page load starts fresh.
export default function ChatWindow({ prof, onClose }) {
  const [session] = useState(() => crypto.randomUUID())
  const [messages, setMessages] = useState(() => [{ role: 'prof', text: GREETINGS[prof.id] ?? `Hi, I'm ${prof.name}. What's on your mind?` }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()
  const logRef = useRef()

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError('')
    setMessages((ms) => [...ms, { role: 'me', text }])
    setSending(true)
    talk.mood = 'thinking'
    try {
      const res = await fetch(`${API}/professors/${prof.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session, message: text }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Server error (${res.status})`)
      const { reply } = await res.json()
      setMessages((ms) => [...ms, { role: 'prof', text: reply }])
      talk.mood = 'talking'
      talk.moodUntil = performance.now() + Math.min(9000, 1200 + reply.length * 45)
    } catch (err) {
      setError(err instanceof TypeError ? "Can't reach the professors' server. Is the backend running?" : err.message)
      talk.mood = 'listening'
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const startOver = () => {
    fetch(`${API}/professors/${prof.id}/chat/${session}`, { method: 'DELETE' }).catch(() => {})
    setMessages((ms) => ms.slice(0, 1))
    setError('')
  }

  return (
    <aside className="chat" role="dialog" aria-label={`Chat with ${prof.name}`}>
      <header className="chathead">
        <div>
          <div className="kicker">{prof.course}</div>
          <h2>{prof.name}</h2>
        </div>
        <button className="chatx" onClick={() => onClose(true)} aria-label="Close chat and keep walking">
          ✕
        </button>
      </header>
      <div className="chatlog" ref={logRef} role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {sending && (
          <div className="msg prof typing" aria-label={`${prof.name} is thinking`}>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      {error && (
        <div className="chaterr" role="alert">
          {error}
        </div>
      )}
      <form className="chatform" onSubmit={send}>
        <label htmlFor="chat-input" className="sr">
          Message {prof.name}
        </label>
        <input
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ${prof.name} something…`}
          maxLength={2000}
          autoComplete="off"
        />
        <button className="go" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
      <div className="chatfoot">
        <button className="linkbtn" onClick={startOver}>
          Start over
        </button>
        <span>Esc to close · AI professor, can make mistakes</span>
      </div>
    </aside>
  )
}
