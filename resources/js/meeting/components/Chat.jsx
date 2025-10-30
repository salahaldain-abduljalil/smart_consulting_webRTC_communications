import React, { useEffect, useState } from 'react'

export default function Chat({ onSend }) {
    const [messages, setMessages] = useState([])
    const [text, setText] = useState('')

    useEffect(() => {
        function handler(e) {
            const { from, message } = e.detail
            setMessages(prev => [...prev, { from, message, ts: Date.now() }])
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('meeting:chat', handler)
            return () => window.removeEventListener('meeting:chat', handler)
        }
        return () => { }
    }, [])

    function submit(e) {
        e.preventDefault()
        if (!text.trim()) return
        onSend(text.trim())
        setText('')
    }

    return (
        <div className="mt-4 flex-1 flex flex-col">
            <div className="flex-1 overflow-auto p-2 space-y-2" style={{ maxHeight: '300px' }}>
                {messages.map((m, idx) => (
                    <div key={idx} className="text-sm">
                        <span className="font-medium">{m.from}:</span> <span>{m.message}</span>
                    </div>
                ))}
            </div>

            <form onSubmit={submit} className="mt-2 flex gap-2">
                <input className="flex-1 border rounded px-2 py-1" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message" />
                <button className="px-3 py-1 bg-blue-600 text-white rounded">Send</button>
            </form>
        </div>
    )
}
