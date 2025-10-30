import { useEffect, useRef, useState } from 'react'

// default ICE servers; will be overridden with TURN/STUN from server if available
const DEFAULT_ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

import MediasoupClient from '../sfu/mediasoupClient'

export default function useWebRTC({ room, user, useSFU = true }) {
    const localStreamRef = useRef(null)
    const pcsRef = useRef({}) // peerId -> RTCPeerConnection
    const [localStream, setLocalStream] = useState(null)
    const [remoteStreams, setRemoteStreams] = useState({})
    const [participants, setParticipants] = useState({})
    const [muted, setMuted] = useState(false)
    const [cameraOn, setCameraOn] = useState(true)
    const [screenSharing, setScreenSharing] = useState(false)
    const screenStreamRef = useRef(null)

    // Robust POST helper: prefer window.axios if available, otherwise use fetch.
    async function postJSON(url, body = {}) {
        try {
            if (typeof window !== 'undefined' && window.axios && typeof window.axios.post === 'function') {
                try {
                    const resp = await window.axios.post(url, body)
                    return { data: resp.data, status: resp.status, statusText: resp.statusText }
                } catch (err) {
                    // normalize axios error to have response-like shape
                    const r = err?.response
                    throw { response: { status: r?.status, data: r?.data, statusText: r?.statusText } }
                }
            }

            const headers = { 'Content-Type': 'application/json' }
            const csrf = (typeof document !== 'undefined') ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') : null
            if (csrf) headers['X-CSRF-TOKEN'] = csrf

            const resp = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify(body || {})
            })

            const contentType = resp.headers.get('content-type') || ''
            const data = contentType.includes('application/json') ? await resp.json() : await resp.text()
            if (!resp.ok) {
                // throw similar shape to axios error
                throw { response: { status: resp.status, data, statusText: resp.statusText } }
            }
            return { data, status: resp.status, statusText: resp.statusText }
        } catch (err) {
            // rethrow to let callers handle
            throw err
        }
    }

    useEffect(() => {
        let mounted = true

        // small helpers to detect media API availability
        const hasGetUserMedia = () => (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
        const hasGetDisplayMedia = () => (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function')


        async function tryAcquireAndStart() {
            // If we don't have a user object (not authenticated), show friendly error and stop
            if (!user || !user.id) {
                window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'NOT_AUTHENTICATED', message: 'Please sign in to join this meeting.' } }))
                return
            }

            try {
                // Acquire the meeting slot on server (enforces single-occupant policy)
                await postJSON(`/meeting/${room}/acquire`, {})
            } catch (err) {
                const status = err?.response?.status
                if (status === 423) {
                    // room occupied
                    window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'ROOM_OCCUPIED', message: 'This meeting already has an active participant.' } }))
                    return
                }
                const msg = err?.response?.data?.message || err?.message || 'Failed to acquire meeting slot.'
                console.error('acquire error', err)
                window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'ACQUIRE_FAILED', message: msg } }))
                return
            }

            async function getMedia() {
                try {
                    // attempt to fetch TURN credentials (overwrites ICE servers if available)
                    try { await fetchTurnCredentials() } catch (err) { console.warn('no TURN credentials', err) }
                    if (!hasGetUserMedia()) {
                        window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'MEDIA_UNSUPPORTED', message: 'Your browser does not support camera/microphone access.' } }))
                        return
                    }
                    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    if (!mounted) return
                    localStreamRef.current = s
                    setLocalStream(s)
                    // If using SFU, connect producer to SFU
                    if (useSFU) {
                        try {
                            await ensureSFUConnected()
                            await produceToSFU(s)
                        } catch (err) {
                            console.warn('SFU produce failed', err)
                        }
                    }
                    joinPresence()
                    startHeartbeat()
                } catch (e) {
                    console.error('media error', e)
                    await handleGetUserMediaError(e)
                }
            }

            await getMedia()
        }

        tryAcquireAndStart()

        // allow user to retry connection attempts from the UI (toaster)
        async function onRetry() {
            try {
                // attempt to (re)fetch TURN and SFU tokens and connect
                try { await fetchTurnCredentials() } catch (err) { /* ignore - will show below */ }
                if (useSFU) {
                    try {
                        await ensureSFUConnected()
                        if (localStreamRef.current) await produceToSFU(localStreamRef.current)
                        window.dispatchEvent(new CustomEvent('meeting:toast', { detail: { type: 'success', title: 'Reconnected', message: 'Successfully reconnected to SFU.' } }))
                    } catch (err) {
                        window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'SFU_RETRY_FAILED', message: err?.response?.data?.message || err?.message || 'Reconnect failed' } }))
                    }
                }
            } catch (e) {
                console.warn('retry handler error', e)
            }
        }

        window.addEventListener('meeting:retry', onRetry)

        return () => {
            mounted = false
            stopHeartbeat()
            // release slot on server
            try {
                // prefer sendBeacon for synchronous unload
                if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                    const url = `/meeting/${room}/release`
                    const payload = JSON.stringify({})
                    navigator.sendBeacon(url, payload)
                } else {
                    postJSON(`/meeting/${room}/release`, {}).catch(() => { })
                }
            } catch (e) {
                // best-effort
            }
            // close tracks
            (localStreamRef.current?.getTracks() || []).forEach(t => t.stop())
            // close PCs
            Object.values(pcsRef.current).forEach(pc => pc.close())
            window.removeEventListener('meeting:retry', onRetry)
        }
    }, [])

    function joinPresence() {
        if (!window.Echo) {
            window.dispatchEvent(new CustomEvent('meeting:toast', { detail: { type: 'info', title: 'Realtime unavailable', message: 'Realtime presence and chat are not connected.' } }))
            return
        }
        const channel = window.Echo.join(`webrtc.${room}`)

        channel.here((members) => {
            const m = {}
            members.forEach(member => { m[member.id] = member })
            setParticipants(prev => ({ ...prev, ...m }))
            // create offers to existing members if rule matches
            members.forEach(member => {
                if (member.id === user?.id) return
                const shouldInitiate = String(user?.id) < String(member.id)
                if (shouldInitiate) initiateConnection(member.id)
            })
        })

        channel.joining((member) => {
            setParticipants(prev => ({ ...prev, [member.id]: member }))
            // existing users will get here and may create offer to newcomer based on ordering rule
            const shouldInitiate = String(user?.id) < String(member.id)
            if (shouldInitiate) initiateConnection(member.id)
        })

        channel.leaving((member) => {
            setParticipants(prev => { const copy = { ...prev }; delete copy[member.id]; return copy })
            setRemoteStreams(prev => { const copy = { ...prev }; delete copy[member.id]; return copy })
            const pc = pcsRef.current[member.id]
            if (pc) { pc.close(); delete pcsRef.current[member.id] }
        })

        channel.listen('.signaling', (e) => {
            const payload = e.payload || e
            handleSignaling(payload)
        })
    }

    async function initiateConnection(peerId) {
        if (pcsRef.current[peerId]) return
        const pc = new RTCPeerConnection(iceServersRef.current || DEFAULT_ICE)
        pcsRef.current[peerId] = pc

        attachLocalTracks(pc)

        pc.onicecandidate = (ev) => {
            if (ev.candidate) {
                sendSignal({ type: 'ice', to: peerId, candidate: ev.candidate })
            }
        }

        pc.ontrack = (ev) => {
            setRemoteStreams(prev => ({ ...prev, [peerId]: ev.streams[0] }))
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal({ type: 'offer', to: peerId, sdp: pc.localDescription })
    }

    function attachLocalTracks(pc) {
        // prefer current screen stream if screen sharing, otherwise local camera stream
        const stream = screenStreamRef.current || localStreamRef.current
            (stream?.getTracks() || []).forEach(t => pc.addTrack(t, stream))
    }

    // --- SFU helpers (mediasoup) ---
    const msClientRef = useRef(null)
    const sendTransport = useRef(null)
    const recvTransport = useRef(null)
    const iceServersRef = useRef(DEFAULT_ICE)

    async function fetchTurnCredentials() {
        // retry a couple times in case TURN service is temporarily unavailable
        let attempts = 0
        const maxAttempts = 2
        let lastErr = null
        while (attempts < maxAttempts) {
            attempts++
            try {
                const res = await postJSON(`/meeting/${room}/turn-credentials`, {})
                const iceServers = res.data?.iceServers
                if (iceServers) iceServersRef.current = { iceServers }
                return iceServersRef.current
            } catch (err) {
                lastErr = err
                console.warn(`fetchTurnCredentials attempt ${attempts} failed`, err)
                await new Promise(r => setTimeout(r, 300 * attempts))
            }
        }
        const msg = lastErr?.response?.data?.message || lastErr?.message || 'Failed to fetch TURN credentials'
        window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'TURN_FETCH_FAILED', message: msg } }))
        throw lastErr
    }

    async function ensureSFUConnected() {
        if (msClientRef.current) return
        const url = (window.location.protocol === 'https:' ? 'wss' : 'ws') + '://' + (window.location.hostname || 'localhost') + ':4000'
        const client = new MediasoupClient({ url, roomId: room })
        // Try to fetch token with a small retry/backoff in case of transient 500s
        let attempts = 0
        const maxAttempts = 3
        let lastErr = null
        while (attempts < maxAttempts) {
            attempts++
            try {
                const res = await postJSON(`/meeting/${room}/sfu-token`, {})
                const token = res?.data?.token
                if (!token) throw new Error('no token returned')
                await client.connect(token)
                msClientRef.current = client
                lastErr = null
                break
            } catch (err) {
                lastErr = err
                console.warn(`sfu-token attempt ${attempts} failed`, err)
                // If it's a 4xx (auth) don't retry
                const status = err?.response?.status
                if (status && status >= 400 && status < 500) {
                    break
                }
                // small backoff
                await new Promise(r => setTimeout(r, 500 * attempts))
            }
        }
        if (lastErr) {
            console.error('SFU auth/connect error', lastErr)
            // surface friendly error to UI
            const msg = lastErr?.response?.data?.message || lastErr.message || 'Failed to get SFU token or connect'
            window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'SFU_AUTH_FAILED', message: msg } }))
            throw lastErr
        }

        // subscribe to newProducer events
        client.onNewProducer = async ({ producerId }) => {
            try {
                await consumeProducer(producerId)
            } catch (err) {
                console.warn('consume error', err)
            }
        }
    }

    async function produceToSFU(stream) {
        const client = msClientRef.current
        if (!client) return
        // create sendTransport via mediasoup-client helper and produce each local track
        if (!client.sendTransport) {
            await client.createSendTransport()
        }

        for (const track of stream.getTracks()) {
            try {
                await client.produceLocalTrack(track)
            } catch (err) {
                console.warn('produceLocalTrack failed', err)
            }
        }
    }

    async function consumeProducer(producerId) {
        const client = msClientRef.current
        if (!client) return
        try {
            const res = await client.consume(producerId)
            if (res && res.stream) {
                setRemoteStreams(prev => ({ ...prev, [producerId]: res.stream }))
            }
        } catch (err) {
            console.warn('consumeProducer error', err)
        }
    }

    // toggle microphone
    function toggleMute() {
        const audioTracks = localStreamRef.current?.getAudioTracks() || []
        if (audioTracks.length === 0) return
        const newMuted = !muted
        audioTracks.forEach(t => t.enabled = !newMuted)
        setMuted(newMuted)
    }

    // toggle camera
    function toggleCamera() {
        const videoTracks = localStreamRef.current?.getVideoTracks() || []
        if (videoTracks.length === 0) return
        const newCameraOn = !cameraOn
        videoTracks.forEach(t => t.enabled = newCameraOn)
        setCameraOn(newCameraOn)
    }

    // screen share: replace outgoing video tracks with display track
    async function startScreenShare() {
        if (screenSharing) return
        try {
            if (!hasGetDisplayMedia()) {
                window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'SCREEN_SHARE_UNSUPPORTED', message: 'Screen sharing is not supported by this browser.' } }))
                return
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
            screenStreamRef.current = stream
            setScreenSharing(true)

            // replace senders' tracks with screen's video track
            const screenTrack = stream.getVideoTracks()[0]
            Object.values(pcsRef.current).forEach(pc => {
                const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video')
                if (senders.length) {
                    senders.forEach(sender => {
                        if (sender.replaceTrack) {
                            sender.replaceTrack(screenTrack).catch(() => { })
                        }
                    })
                } else {
                    // fallback: add track
                    pc.addTrack(screenTrack, stream)
                }
            })

            // when screen sharing stops, restore camera
            screenTrack.onended = async () => {
                await stopScreenShare()
            }
        } catch (err) {
            console.error('screen share failed', err)
            window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'SCREEN_SHARE_FAILED', message: 'Failed to start screen sharing.' } }))
        }
    }

    async function stopScreenShare() {
        if (!screenSharing) return
        const screen = screenStreamRef.current
        if (screen) {
            (screen.getTracks() || []).forEach(t => t.stop())
        }
        screenStreamRef.current = null
        setScreenSharing(false)

        // restore camera track to senders
        const camTrack = localStreamRef.current?.getVideoTracks()[0]
        if (camTrack) {
            Object.values(pcsRef.current).forEach(pc => {
                const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video')
                if (senders.length) {
                    senders.forEach(sender => {
                        if (sender.replaceTrack) {
                            sender.replaceTrack(camTrack).catch(() => { })
                        }
                    })
                } else {
                    pc.addTrack(camTrack, localStreamRef.current)
                }
            })
        }
    }

    async function handleGetUserMediaError(e) {
        // Handle NotReadableError (device in use) and provide fallbacks
        const name = e?.name || ''
        const msg = e?.message || ''
        if (name === 'NotReadableError' || msg.toLowerCase().includes('device') && msg.toLowerCase().includes('in use')) {
            try {
                if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
                    window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'MEDIA_UNSUPPORTED', message: 'Cannot enumerate media devices on this platform.' } }))
                    return
                }
                const devices = await navigator.mediaDevices.enumerateDevices()
                const videoDevices = devices.filter(d => d.kind === 'videoinput')
                // try alternate device if available
                if (videoDevices.length > 1) {
                    const current = videoDevices[0]
                    const alt = videoDevices.find(d => d.deviceId !== current.deviceId) || videoDevices[1]
                    try {
                        if (!hasGetUserMedia()) throw new Error('getUserMedia unavailable')
                        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: alt.deviceId }, audio: true })
                        localStreamRef.current = s
                        setLocalStream(s)
                        joinPresence()
                        startHeartbeat()
                        return
                    } catch (err) {
                        console.warn('fallback device failed', err)
                    }
                }

                // try audio-only fallback
                try {
                    if (!hasGetUserMedia()) throw new Error('getUserMedia unavailable')
                    const s = await navigator.mediaDevices.getUserMedia({ audio: true })
                    localStreamRef.current = s
                    setLocalStream(s)
                    joinPresence()
                    startHeartbeat()
                    return
                } catch (err) {
                    console.warn('audio-only fallback failed', err)
                }
            } catch (err) {
                console.error('enumerate devices failed', err)
            }

            window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'DEVICE_IN_USE', message: 'Camera or microphone appears to be in use by another application. Please close other apps or select another device.' } }))
            return
        }

        // Other errors: Overconstrained -> try relaxed constraints
        if (name === 'OverconstrainedError') {
            try {
                if (!hasGetUserMedia()) throw new Error('getUserMedia unavailable')
                const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
                localStreamRef.current = s
                setLocalStream(s)
                joinPresence()
                startHeartbeat()
                return
            } catch (err) {
                console.error('fallback overconstrained failed', err)
            }
        }

        window.dispatchEvent(new CustomEvent('meeting:error', { detail: { code: 'MEDIA_ERROR', message: e?.message || 'Failed to access media devices' } }))
    }

    // Heartbeat to refresh server-side lock
    let hbTimer = null
    function startHeartbeat() {
        stopHeartbeat()
        hbTimer = setInterval(() => {
            postJSON(`/meeting/${room}/heartbeat`, {}).catch(() => { })
        }, (60 * 1000) * 5) // every 5 minutes
    }

    function stopHeartbeat() {
        if (hbTimer) clearInterval(hbTimer)
        hbTimer = null
    }

    async function handleSignaling(payload) {
        const { type, from, to, sdp, candidate, message } = payload
        if (to && String(to) !== String(user?.id)) return

        if (type === 'offer') {
            const peerId = from
            if (pcsRef.current[peerId]) return
            const pc = new RTCPeerConnection(iceServersRef.current || DEFAULT_ICE)
            pcsRef.current[peerId] = pc
            attachLocalTracks(pc)

            pc.onicecandidate = (ev) => {
                if (ev.candidate) {
                    sendSignal({ type: 'ice', to: peerId, candidate: ev.candidate })
                }
            }

            pc.ontrack = (ev) => {
                setRemoteStreams(prev => ({ ...prev, [peerId]: ev.streams[0] }))
            }

            await pc.setRemoteDescription(new RTCSessionDescription(sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await sendSignal({ type: 'answer', to: peerId, sdp: pc.localDescription })
        }

        if (type === 'answer') {
            const pc = pcsRef.current[from]
            if (!pc) return
            await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        }

        if (type === 'ice') {
            const pc = pcsRef.current[from]
            if (!pc) return
            try {
                await pc.addIceCandidate(candidate)
            } catch (e) { console.warn('ICE error', e) }
        }

        if (type === 'chat') {
            // dispatch chat event locally via CustomEvent so UI can pick it up
            window.dispatchEvent(new CustomEvent('meeting:chat', { detail: { from, message } }))
        }
    }

    async function sendSignal(payload) {
        try {
            await postJSON('/signaling/send', { room, payload })
        } catch (e) {
            console.error('signal send error', e)
        }
    }

    function sendChat(message) {
        sendSignal({ type: 'chat', from: user?.id, name: user?.name, message })
        // also emit local event so sender sees it immediately
        window.dispatchEvent(new CustomEvent('meeting:chat', { detail: { from: user?.id, message } }))
    }

    function leave() {
        // close local tracks and connections
        (localStreamRef.current?.getTracks() || []).forEach(t => t.stop())
        Object.values(pcsRef.current).forEach(pc => pc.close())
        pcsRef.current = {}
        setRemoteStreams({})
        // redirect away
        window.location.href = '/'
    }

    return { localStream, remoteStreams, participants, sendChat, sendSignal, leave, toggleMute, toggleCamera, startScreenShare, stopScreenShare, muted, cameraOn, screenSharing }
}

