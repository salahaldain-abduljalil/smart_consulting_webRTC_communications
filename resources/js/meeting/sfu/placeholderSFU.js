// SFU placeholder client
// This file is a small shim that documents how to plug an SFU (mediasoup/Janus) into
// the application. It intentionally does not implement a server-side SFU here.
// To integrate a real SFU, implement the methods below and call them from the
// useWebRTC hook (instead of doing mesh peer connections).

export default class PlaceholderSFU {
    constructor(opts = {}) {
        this.opts = opts
        this.connected = false
    }

    async connect() {
        // connect to SFU signalling (e.g., websocket)
        // negotiate router rtpCapabilities, create transport(s) and prepare to send/receive
        this.connected = true
        throw new Error('SFU client not implemented. Implement connect() to talk to your SFU.');
    }

    async publishTrack(track) {
        if (!this.connected) throw new Error('Not connected to SFU')
        // publish a track to the SFU
        throw new Error('publishTrack not implemented')
    }

    async unpublishTrack(track) {
        // stop publishing
        throw new Error('unpublishTrack not implemented')
    }

    async close() {
        this.connected = false
    }
}
