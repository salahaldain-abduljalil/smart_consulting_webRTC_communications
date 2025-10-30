@extends('layouts.app')

@section('content')
<div class="max-w-5xl mx-auto p-6">
    <h1 class="text-2xl font-semibold mb-4">Consultation Details</h1>
    <div class="bg-white border rounded p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><span class="font-medium">Category:</span> {{ $consultation->category }}</div>
            <div><span class="font-medium">Purpose:</span> {{ $consultation->purpose }}</div>
            <div><span class="font-medium">Status:</span> {{ $consultation->status }}</div>
            @if($consultation->session)
                <div><span class="font-medium">Scheduled At:</span> {{ optional($consultation->session->scheduled_at)->format('Y-m-d H:i') }}</div>
                <div><span class="font-medium">Meeting ID:</span> {{ $consultation->session->meeting_id }}</div>
            @endif
        </div>
    </div>

    @if($consultation->session)
    <div id="webrtc-app" class="bg-gray-50 border rounded p-4">
        <h2 class="text-xl font-semibold mb-3">Video Session</h2>
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
    <script>
    // Minimal WebRTC with Reverb presence channel signaling
    (async () => {
        const meetingId = @json($consultation->session->meeting_id);
        const room = meetingId;
        const localVideo = document.getElementById('local');
        const remoteVideo = document.getElementById('remote');
        const pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
        const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        localVideo.srcObject = stream;

        pc.ontrack = (e) => { remoteVideo.srcObject = e.streams[0]; };

        async function postSignaling(payload){
            await fetch(@json(route('signaling.send')), {
                method:'POST', headers:{'Content-Type':'application/json','X-CSRF-TOKEN': @json(csrf_token())},
                body: JSON.stringify({room, payload})
            });
        }

        window.Echo.join('webrtc.'+room)
            .listen('.signaling', async (e) => {
                const msg = e.payload;
                if(msg.sdp){
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                    if(msg.sdp.type === 'offer'){
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await postSignaling({sdp: pc.localDescription});
                    }
                } else if(msg.candidate){
                    try{ await pc.addIceCandidate(msg.candidate); }catch{}
                }
            });

        pc.onicecandidate = ({candidate}) => {
            if(candidate){ postSignaling({candidate}); }
        };

        // If first to join, create an offer
        const offer = await pc.createOffer({offerToReceiveVideo:true, offerToReceiveAudio:true});
        await pc.setLocalDescription(offer);
        await postSignaling({sdp: pc.localDescription});

        // UI controls
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
    })();
    </script>
    @endif
</div>
@endsection



