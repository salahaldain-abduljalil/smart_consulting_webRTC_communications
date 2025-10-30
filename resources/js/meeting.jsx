import React from 'react'
import { createRoot } from 'react-dom/client'
import MeetingRoom from './meeting/MeetingRoom'

const initial = window.__MEETING_INITIAL_STATE__ || {}

function App() {
  return <MeetingRoom room={initial.room} user={initial.user} />
}

const el = document.getElementById('react-meeting')
if (el) {
  const root = createRoot(el)
  root.render(<App />)
}
