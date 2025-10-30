/*
 * Minimal mediasoup client helper using WebSocket signalling.
 * This client pairs with the `sfu-server/server.js` scaffold in this repo.
 * It implements a small request/response over WS and helpers to create transports,
 * produce local tracks and consume remote producers.
 *
 * NOTE: This is a simplified client for integration and learning purposes. For
 * production use study the mediasoup-client examples and handle re-connections,
 * device selection, multi-transport handling, and robust error paths.
 */

import * as mediasoupClient from 'mediasoup-client'

export default class MediasoupClient {
    constructor({ url, roomId }) {
        this.url = url
        this.roomId = roomId
        this.ws = null
        this._pending = new Map()
        this._reqCounter = 1

        this.device = null
        this.sendTransport = null
        this.recvTransports = new Map()
    }

    async connect(token) {
        // token: ephemeral HMAC token from Laravel
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url)
            this.ws.onopen = async () => {
                try {
                    await this._send({ action: 'join', roomId: this.roomId, token })
                    // load device
                    const rtpCapabilities = await this.getRouterRtpCapabilities()
                    this.device = new mediasoupClient.Device()
                    await this.device.load({ routerRtpCapabilities: rtpCapabilities })
                    resolve()
                } catch (err) {
                    reject(err)
                }
            }
            this.ws.onmessage = (ev) => this._handleMessage(ev)
            this.ws.onerror = (e) => reject(e)
            this.ws.onclose = async () => {
                // try reconnect after a delay
                setTimeout(() => {
                    this.connect(token).catch(() => { })
                }, 2000)
            }
        })
    }

    _send(msg) {
        const requestId = String(this._reqCounter++)
        const payload = { ...msg, requestId }
        const p = new Promise((resolve, reject) => {
            this._pending.set(requestId, { resolve, reject })
            this.ws.send(JSON.stringify(payload))
        })
        return p
    }

    _handleMessage(ev) {
        try {
            const data = JSON.parse(ev.data)
            if (data.responseId) {
                const req = this._pending.get(String(data.responseId))
                if (req) {
                    req.resolve(data.payload)
                    this._pending.delete(String(data.responseId))
                }
            } else if (data.event === 'newProducer') {
                if (this.onNewProducer) this.onNewProducer(data.data)
            }
        } catch (err) {
            console.warn('mediasoupClient parse message', err)
        }
    }

    async getRouterRtpCapabilities() {
        const res = await this._send({ action: 'getRouterRtpCapabilities', roomId: this.roomId })
        return res.rtpCapabilities
    }

    async createSendTransport() {
        const params = await this._send({ action: 'createWebRtcTransport', roomId: this.roomId })

        const transport = this.device.createSendTransport({
            id: params.id,
            iceParameters: params.iceParameters,
            iceCandidates: params.iceCandidates,
            dtlsParameters: params.dtlsParameters,
        })

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            this._send({ action: 'connectTransport', roomId: this.roomId, payload: { transportId: params.id, dtlsParameters } })
                .then(callback)
                .catch(errback)
        })

        transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
            try {
                const res = await this._send({ action: 'produce', roomId: this.roomId, payload: { transportId: params.id, kind, rtpParameters } })
                callback({ id: res.id })
            } catch (err) {
                errback(err)
            }
        })

        this.sendTransport = transport
        return transport
    }

    async produceLocalTrack(track) {
        if (!this.sendTransport) {
            await this.createSendTransport()
        }
        const producer = await this.sendTransport.produce({ track })
        return producer.id
    }

    async createRecvTransport() {
        const params = await this._send({ action: 'createConsumerTransport', roomId: this.roomId })

        const transport = this.device.createRecvTransport({
            id: params.id,
            iceParameters: params.iceParameters,
            iceCandidates: params.iceCandidates,
            dtlsParameters: params.dtlsParameters,
        })

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            this._send({ action: 'connectTransport', roomId: this.roomId, payload: { transportId: params.id, dtlsParameters } })
                .then(callback)
                .catch(errback)
        })

        this.recvTransports.set(params.id, transport)
        return { transport, id: params.id }
    }

    async consume(producerId) {
        // create recv transport
        const { transport, id: transportId } = await this.createRecvTransport()

        // ask server to create consumer and return rtpParameters
        const res = await this._send({ action: 'consume', roomId: this.roomId, payload: { producerId, transportId, rtpCapabilities: this.device.rtpCapabilities } })

        const consumer = await transport.consume({
            id: res.id,
            producerId: res.producerId,
            kind: res.kind,
            rtpParameters: res.rtpParameters,
        })

        const stream = new MediaStream()
        stream.addTrack(consumer.track)
        // resume if paused
        if (consumer.paused) {
            await this._send({ action: 'resumeConsumer', roomId: this.roomId, payload: { consumerId: res.id } }).catch(() => { })
            try { await consumer.resume() } catch (e) { }
        }

        return { stream, consumer }
    }

}
