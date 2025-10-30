@extends('layouts.app')

@section('content')
<div class="max-w-5xl mx-auto p-6">
    <h1 class="text-2xl font-semibold mb-4">Session</h1>
    <div class="mb-6">Meeting: {{ $session->meeting_id }} | When:
        {{ optional($session->scheduled_at)->format('Y-m-d H:i') }}</div>
    <div class="bg-gray-50 border rounded p-4 mb-6">
        <div class="flex items-center gap-3 mb-4">
            <button id="toggleCam" class="px-3 py-2 bg-blue-600 text-white rounded">Toggle Camera</button>
            <button id="toggleMic" class="px-3 py-2 bg-blue-600 text-white rounded">Toggle Mic</button>
            <button id="leave" class="px-3 py-2 bg-red-600 text-white rounded">Leave</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <video id="local" autoplay playsinline muted class="w-full bg-black rounded aspect-video"></video>
            <video id="remote" autoplay playsinline class="w-full bg-black rounded aspect-video"></video>
        </div>
    </div>

    <form method="POST" action="{{ route('advisor.sessions.report', $session) }}" class="space-y-3">
        @csrf
        <label class="block text-sm font-medium">Session Report</label>
        <textarea name="report" class="w-full border rounded px-3 py-2" rows="6" required></textarea>
        <button class="bg-green-600 text-white px-4 py-2 rounded">Submit Report</button>
    </form>

    <script>
        (async () => {
                const meetingId = @json($session->meeting_id);
                const roomUrl = `${window.location.href}?room=${meetingId}`;
                console.log(roomUrl);
                const room = meetingId;
                const localVideo = document.getElementById('local');
                const remoteVideo = document.getElementById('remote');

                try {
                    const pc = new RTCPeerConnection({
                        iceServers: [{
                            urls: 'stun:stun.l.google.com:19302'
                        }]
                    });

                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });
                    stream.getTracks().forEach(t => pc.addTrack(t, stream));
                    localVideo.srcObject = stream;

                    pc.ontrack = (e) => {
                        remoteVideo.srcObject = e.streams[0];
                    };

                    async function postSignaling(payload) {
                        await fetch(@json(route('signaling.send')), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-TOKEN': @json(csrf_token())
                            },
                            body: JSON.stringify({
                                room,
                                payload
                            })
                        });
                    }

                    window.Echo.join('webrtc.' + room)
                        .listen('.signaling', async (e) => {
                            const msg = e.payload;

                            if (msg.sdp) {
                                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                                if (msg.sdp.type === 'offer') {
                                    const answer = await pc.createAnswer();
                                    await pc.setLocalDescription(answer);
                                    await postSignaling({
                                        sdp: pc.localDescription
                                    });
                                }
                            } else if (msg.candidate) {
                                try {
                                    await pc.addIceCandidate(msg.candidate);
                                } catch (error) {
                                    console.error('Error adding ICE candidate:', error);
                                }
                            }
                        });

                    pc.onicecandidate = ({
                        candidate
                    }) => {
                        if (candidate) {
                            postSignaling({
                                candidate
                            });
                        }
                    };


                    pc.oniceconnectionstatechange = () => {
                        console.log('ICE state:', pc.iceConnectionState);
                        switch (pc.iceConnectionState) {
                            case 'new':
                                console.log('ICE new');
                                break;
                            case 'checking':
                                console.log('ICE checking');
                                break;
                            case 'connected':
                                console.log('ICE connected');
                                break;
                            case 'completed':
                                console.log('ICE completed');
                                break;
                            case 'disconnected':
                                console.log('ICE disconnected');
                                break;
                            case 'failed':
                                console.log('ICE failed');
                                break;
                            case 'closed':
                                console.log('ICE closed');
                                break;
                        }
                    };

                    window.Echo.join('webrtc.' + room)
                        .here((users) => {
                            console.log(users.length + ' users in the room');
                            console.log(' users in the room');
                            // Update UI to reflect number of users
                        })
                        .joining((user) => {
                            console.log('User joined:', user);
                            // Update UI to reflect new user
                        })
                        .leaving((user) => {
                            console.log('User left:', user);
                            // Update UI to reflect user left
                        });



                    pc.onconnectionstatechange = () => {
                        switch (pc.connectionState) {
                            case 'connected':
                                console.log('تم الاتصال');
                                break;
                            case 'disconnected':
                                console.log('تم قطع الاتصال');
                                break;
                            case 'failed':
                                console.log('فشل الاتصال');
                                break;
                        }
                    };


                    const offer = await pc.createOffer({
                        offerToReceiveVideo: true,
                        offerToReceiveAudio: true
                    });
                    await pc.setLocalDescription(offer);
                    await postSignaling({
                        sdp: pc.localDescription
                    });

                    document.getElementById('toggleCam').onclick = () => {
                        stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
                    };

                    document.getElementById('toggleMic').onclick = () => {
                        stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
                    };

                    document.getElementById('leave').onclick = () => {
                        pc.getSenders().forEach(s => s.track && s.track.stop());
                        pc.close();
                    };
                } catch (error) {
                    console.error('Error:', error);
                }
            })();
    </script>
</div>
@endsection
