/**
 * Minimal mediasoup SFU server scaffold.
 *
 * This is a simple example that creates a mediasoup Worker and accepts
 * WebSocket connections from clients. It handles basic requests to:
 * - getRouterRtpCapabilities
 * - createTransport / connectTransport
 * - produce
 * - consume
 *
 * NOTE: This is a minimal scaffold to get started. For production usage you
 * must add authorization, room management, scalability (multiple workers),
 * proper error handling, NAT/ICE configuration, and TLS.
 */

require('dotenv').config()
const mediasoup = require('mediasoup')
const { v4: uuidv4 } = require('uuid')
const WebSocket = require('ws')

const PORT = process.env.PORT || 4000

async function run() {
    const workerCount = parseInt(process.env.WORKER_COUNT || '1', 10)
    const workers = []
    for (let i = 0; i < workerCount; i++) {
        const w = await mediasoup.createWorker({ rtcMinPort: 10000 + i * 100, rtcMaxPort: 10099 + i * 100 })
        console.log('mediasoup Worker PID', w.pid)
        workers.push(w)
    }

    function pickWorker(roomId) {
        const idx = Math.abs(hashCode(roomId)) % workers.length
        return workers[idx]
    }

    // routers per room
    const routers = new Map() // roomId -> router

    // Simple in-memory room state
    const rooms = new Map() // roomId -> { transports, producers, consumers, peers }

    const wss = new WebSocket.Server({ port: PORT })

    wss.on('connection', (ws) => {
        ws.id = uuidv4()
        ws.isAlive = true
        ws.on('pong', () => ws.isAlive = true)

        ws.on('message', async (msg) => {
            try {
                const data = JSON.parse(msg)
                const { action, roomId, payload, requestId, token } = data

                switch (action) {
                    case 'join': {
                        // validate token
                        try {
                            validateToken(token, roomId)
                        } catch (err) {
                            sendResponse(ws, requestId, { error: 'invalid token' })
                            break
                        }

                        // create router for room if not exists
                        if (!rooms.has(roomId)) {
                            const worker = pickWorker(roomId)
                            const router = await worker.createRouter({
                                mediaCodecs: [
                                    { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
                                    { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 }
                                ]
                            })
                            routers.set(roomId, router)
                            rooms.set(roomId, { transports: new Map(), producers: new Map(), consumers: new Map(), peers: new Map() })
                        }
                        rooms.get(roomId).peers.set(ws.id, ws)
                        sendResponse(ws, requestId, { ok: true })
                        break
                    }

                    case 'getRouterRtpCapabilities': {
                        const router = routers.get(roomId)
                        if (!router) return sendResponse(ws, requestId, { error: 'no router' })
                        sendResponse(ws, requestId, { rtpCapabilities: router.rtpCapabilities })
                        break
                    }

                    case 'createWebRtcTransport': {
                        // create transport on mediasoup router
                        const router = routers.get(roomId)
                        if (!router) return sendResponse(ws, requestId, { error: 'no router' })
                        const transport = await router.createWebRtcTransport({
                            listenIps: [{ ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null }],
                            enableUdp: true,
                            enableTcp: true,
                            preferUdp: true,
                        })

                        const transportId = transport.id
                        // store transport in room
                        const room = rooms.get(roomId)
                        room.transports.set(transportId, transport)

                        sendResponse(ws, requestId, {
                            id: transport.id,
                            iceParameters: transport.iceParameters,
                            iceCandidates: transport.iceCandidates,
                            dtlsParameters: transport.dtlsParameters
                        })
                        break
                    }

                    case 'connectTransport': {
                        const { transportId, dtlsParameters } = payload
                        const room = rooms.get(roomId)
                        const transport = room.transports.get(transportId)
                        await transport.connect({ dtlsParameters })
                        sendResponse(ws, requestId, { ok: true })
                        break
                    }

                    case 'produce': {
                        const { transportId, kind, rtpParameters, appData } = payload
                        const room = rooms.get(roomId)
                        const transport = room.transports.get(transportId)
                        const producer = await transport.produce({ kind, rtpParameters, appData })
                        room.producers.set(producer.id, { producer, wsId: ws.id })

                        // notify other peers in room about new producer so they can consume
                        room.peers.forEach((peerWs, pid) => {
                            if (pid === ws.id) return
                            peerWs.send(JSON.stringify({ event: 'newProducer', data: { producerId: producer.id } }))
                        })

                        sendResponse(ws, requestId, { id: producer.id })
                        break
                    }

                    case 'createConsumerTransport': {
                        const transport = await router.createWebRtcTransport({
                            listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
                            enableUdp: true,
                            enableTcp: true,
                            preferUdp: true,
                        })
                        const room = rooms.get(roomId)
                        room.transports.set(transport.id, transport)

                        sendResponse(ws, requestId, {
                            id: transport.id,
                            iceParameters: transport.iceParameters,
                            iceCandidates: transport.iceCandidates,
                            dtlsParameters: transport.dtlsParameters
                        })
                        break
                    }

                    case 'consume': {
                        const { producerId, transportId, rtpCapabilities } = payload
                        const room = rooms.get(roomId)
                        const producerEntry = room.producers.get(producerId)
                        if (!producerEntry) {
                            sendResponse(ws, requestId, { error: 'producer not found' })
                            break
                        }

                        const transport = room.transports.get(transportId)
                        const consumer = await transport.consume({ producerId, rtpCapabilities, paused: false })
                        const consumerId = consumer.id

                        room.consumers.set(consumerId, { consumer, wsId: ws.id })

                        sendResponse(ws, requestId, {
                            id: consumer.id,
                            producerId: producerId,
                            kind: consumer.kind,
                            rtpParameters: consumer.rtpParameters
                        })
                        break
                    }

                    case 'resumeConsumer': {
                        const { consumerId } = payload
                        const room = rooms.get(roomId)
                        const consumerEntry = room.consumers.get(consumerId)
                        if (consumerEntry && consumerEntry.consumer) {
                            try {
                                await consumerEntry.consumer.resume()
                            } catch (e) {/* ignore */ }
                        }
                        sendResponse(ws, requestId, { ok: true })
                        break
                    }

                    default:
                        sendResponse(ws, requestId, { error: 'unknown action' })
                }
            } catch (err) {
                console.error('message handling error', err)
            }
        })

        ws.on('close', () => {
            // cleanup connections from rooms
            rooms.forEach((room) => {
                room.peers.delete(ws.id)
            })
        })
    })

    // basic heartbeat
    setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate()
            ws.isAlive = false
            ws.ping(() => { })
        })
    }, 30000)

    console.log(`mediasoup SFU server running on ws://localhost:${PORT}`)
}

function sendResponse(ws, requestId, payload) {
    ws.send(JSON.stringify({ responseId: requestId, payload }))
}

run().catch(err => {
    console.error('mediasoup server failed', err)
    process.exit(1)
})

function hashCode(str) {
    let h = 0
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0
    return h
}

function validateToken(token, roomId) {
    if (!token) throw new Error('no token')
    try {
        const raw = Buffer.from(token, 'base64').toString('utf8')
        const parts = raw.split(':')
        if (parts.length < 4) throw new Error('bad token')
        const [r, userId, expiry, sig] = parts
        if (r !== roomId) throw new Error('room mismatch')
        const secret = process.env.SFU_SECRET
        if (!secret) throw new Error('no secret')
        const payload = `${r}:${userId}:${expiry}`
        const expected = require('crypto').createHmac('sha256', secret).update(payload).digest('hex')
        if (!cryptoTimingSafeEqual(expected, sig)) throw new Error('invalid signature')
        if (parseInt(expiry, 10) < Math.floor(Date.now() / 1000)) throw new Error('expired')
        return { userId }
    } catch (err) {
        throw err
    }
}

function cryptoTimingSafeEqual(a, b) {
    try {
        const bufA = Buffer.from(a, 'utf8')
        const bufB = Buffer.from(b, 'utf8')
        if (bufA.length !== bufB.length) return false
        return require('crypto').timingSafeEqual(bufA, bufB)
    } catch (e) {
        return false
    }
}
