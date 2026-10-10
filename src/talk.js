// Shared state between the 3D scene and the chat UI, read every frame (so changing it never re-renders).
//   targets: professors you can talk to, registered by their avatar: id -> { object, name, course }
//   active:  id of the professor whose chat window is open, or null
//   mood:    'listening' | 'thinking' | 'talking' while a chat is open
export const talk = { targets: {}, active: null, mood: 'listening', moodUntil: 0 }

export const API = `${import.meta.env.VITE_API_URL ?? ''}/api`
export const TALK_RANGE = 7 // meters: how close you need to be to start a chat
