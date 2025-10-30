import React, { useEffect, useRef, useState } from 'react'
import useWebRTC from './hooks/useWebRTC'
import ParticipantsList from './components/ParticipantsList'
import Chat from './components/Chat'
import Toaster from './components/Toaster'

export default function MeetingRoom({ room, user }) {
    const localVideoRef = useRef(null)
    const { localStream, remoteStreams, participants, sendChat, sendSignal, leave, toggleMute, toggleCamera, startScreenShare, stopScreenShare, muted, cameraOn, screenSharing } = useWebRTC({ room, user, useSFU: true })
    const [error, setError] = useState(null)

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream
        }
    }, [localStream])

    useEffect(() => {
        const h = (e) => setError(e.detail)
        if (typeof window !== 'undefined') {
            window.addEventListener('meeting:error', h)
            return () => window.removeEventListener('meeting:error', h)
        }
        return () => { }
    }, [])

    // Quick health check to surface SFU/TURN problems to users via toaster
    useEffect(() => {
        async function checkHealth() {
            try {
                const resp = await fetch('/health', { method: 'GET', credentials: 'include' })
                if (!resp.ok) {
                    window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'HEALTH_FAIL', message: 'Health check failed' } }))
                    return
                }
                const json = await resp.json()
                if (!json.ok) {
                    const sfuMsg = json.checks?.sfu?.secret_set ? '' : 'SFU secret missing. '
                    const turnMsg = json.checks?.turn?.secret_set ? '' : 'TURN secret missing.'
                    const message = `${sfuMsg}${turnMsg}`.trim() || 'Services not healthy.'
                    window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'UNHEALTHY', message } }))
                }
            } catch (err) {
                console.warn('health check failed', err)
            }
        }
        checkHealth()
    }, [])

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            <Toaster />
            <header className="bg-black bg-opacity-60 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="text-xl font-bold">Zoomy</div>
                    <div className="text-sm text-gray-300">Meeting • {room}</div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-300">{user?.name ?? 'Guest'}</div>
                    <button onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(window.location.href)
                            window.dispatchEvent(new CustomEvent('meeting:toast', { detail: { type: 'success', title: 'Link copied', message: 'Meeting link copied to clipboard.' } }))
                        } catch (e) {
                            window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'CLIPBOARD_FAIL', message: 'Failed to copy link to clipboard.' } }))
                        }
                    }} className="px-3 py-1 bg-blue-600 text-white rounded">Copy link</button>
                </div>
            </header>

            <main className="flex-1 p-4 flex flex-col lg:flex-row gap-4">
                <section className="flex-1 bg-black rounded shadow-lg p-2 flex flex-col items-center justify-center">
                    <div className="w-full h-full max-h-[70vh] grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="relative bg-gray-800 rounded overflow-hidden">
                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            <div className="absolute left-2 bottom-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">You</div>
                        </div>

                        {Object.entries(remoteStreams).map(([peerId, stream]) => (
                            <div key={peerId} className="relative bg-gray-800 rounded overflow-hidden">
                                <video autoPlay playsInline ref={(el) => { if (el) el.srcObject = stream }} className="w-full h-full object-cover" />
                                <div className="absolute left-2 bottom-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">{participants[peerId]?.name ?? peerId}</div>
                            </div>
                        ))}
                    </div>

                    <div className="w-full fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black bg-opacity-60 px-4 py-2 rounded-xl" role="toolbar" aria-label="Meeting controls">
                        <button
                            aria-pressed={muted}
                            aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                            onClick={() => toggleMute()}
                            className={`w-12 h-12 rounded-full ${muted ? 'bg-red-600' : 'bg-green-600'} flex items-center justify-center`}
                        >
                            {muted ? '🔇' : '🎤'}
                        </button>

                        <button
                            aria-pressed={!cameraOn}
                            aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                            onClick={() => toggleCamera()}
                            className={`w-12 h-12 rounded-full ${cameraOn ? 'bg-green-600' : 'bg-red-600'} flex items-center justify-center`}
                        >
                            {cameraOn ? '🎥' : '📷'}
                        </button>

                        <button
                            aria-pressed={screenSharing}
                            aria-label={screenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
                            onClick={() => screenSharing ? stopScreenShare() : startScreenShare()}
                            className={`w-12 h-12 rounded-full ${screenSharing ? 'bg-blue-500' : 'bg-gray-700'} flex items-center justify-center`}
                        >
                            {screenSharing ? '🛑' : '📤'}
                        </button>

                        <button onClick={() => leave()} className="w-32 h-12 rounded-full bg-red-600 flex items-center justify-center">Leave</button>
                    </div>
                </section>

                <aside className="w-full lg:w-96 bg-white text-black bg-opacity-5 rounded p-4 flex flex-col">
                    <ParticipantsList participants={participants} />
                    <Chat onSend={(msg) => sendChat(msg)} />
                </aside>
            </main>

            {error && (
                <div className="fixed right-6 top-20 bg-red-600 text-white px-4 py-3 rounded shadow-lg">
                    <div className="font-semibold">{error.code}</div>
                    <div className="text-sm">{error.message}</div>
                </div>
            )}
        </div>
    )
}
