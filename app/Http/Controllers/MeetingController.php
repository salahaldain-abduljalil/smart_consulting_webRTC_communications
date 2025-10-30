<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class MeetingController extends Controller
{
    // TTL in seconds for the meeting slot (heartbeat refreshes it)
    protected int $slotTtl = 60 * 20; // 20 minutes

    public function create()
    {
        $room = Str::uuid()->toString();

        return redirect()->route('meeting.show', ['room' => $room]);
    }

    public function show(Request $request, string $room)
    {
        $user = $request->user();

        return view('meeting', [
            'room' => $room,
            'user' => $user,
        ]);
    }

    /**
     * Try to acquire the meeting slot for the current user.
     * Returns 200 if acquired, 423 if locked by another user.
     */
    public function acquire(Request $request, string $room)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $key = $this->cacheKey($room);
        $current = Cache::get($key);

        if ($current && (string) $current !== (string) $user->id) {
            return response()->json(['message' => 'Room is occupied'], 423);
        }

        Cache::put($key, $user->id, $this->slotTtl);

        return response()->noContent();
    }

    /**
     * Release the meeting slot if held by current user.
     */
    public function release(Request $request, string $room)
    {
        $user = $request->user();
        $key = $this->cacheKey($room);
        $current = Cache::get($key);

        if ($current && (string) $current === (string) ($user->id ?? '')) {
            Cache::forget($key);
        }

        return response()->noContent();
    }

    /**
     * Heartbeat to refresh the lock TTL.
     */
    public function heartbeat(Request $request, string $room)
    {
        $user = $request->user();
        $key = $this->cacheKey($room);
        $current = Cache::get($key);

        if ($current && (string) $current === (string) ($user->id ?? '')) {
            Cache::put($key, $user->id, $this->slotTtl);
            return response()->noContent();
        }

        return response()->json(['message' => 'Not owner'], 423);
    }

    protected function cacheKey(string $room): string
    {
        return 'webrtc.room.' . $room . '.owner';
    }

    /**
     * Issue an ephemeral token for SFU (mediasoup) authentication.
     * The token is HMAC signed using SFU_SECRET and contains room, user and expiry.
     */
    public function sfuToken(Request $request, string $room)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        try {
            $secret = env('SFU_SECRET');
            if (!$secret) {
                Log::warning('sfuToken requested but SFU_SECRET not set', ['room' => $room, 'user_id' => $user->id]);
                return response()->json(['message' => 'SFU not configured'], 500);
            }

            $expiry = now()->addMinutes(10)->getTimestamp();
            $payload = sprintf('%s:%s:%s', $room, $user->id, $expiry);
            $sig = hash_hmac('sha256', $payload, $secret);
            $token = base64_encode($payload . ':' . $sig);

            return response()->json(['token' => $token, 'expires_at' => $expiry]);
        } catch (\Throwable $e) {
            Log::error('sfuToken error', ['exception' => $e, 'room' => $room, 'user_id' => $user->id]);
            return response()->json(['message' => 'Internal server error while issuing SFU token'], 500);
        }
    }

    /**
     * Generate short-lived TURN credentials for the client using TURN_SECRET.
     * Uses the TURN REST-style username: <expiry>:<userId> and HMAC-SHA1 as password (base64).
     */
    public function turnCredentials(Request $request, string $room)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        try {
            $secret = env('TURN_SECRET');
            if (!$secret) {
                Log::warning('turnCredentials requested but TURN_SECRET not set', ['room' => $room, 'user_id' => $user->id]);
                return response()->json(['message' => 'TURN not configured'], 500);
            }

            $ttl = intval(env('TURN_CREDENTIAL_TTL', 300)); // seconds
            $expiry = time() + $ttl;
            $username = $expiry . ':' . $user->id;
            $hmac = hash_hmac('sha1', $username, $secret, true);
            $password = base64_encode($hmac);

            // ICE servers list (can include multiple TURN/STUN entries)
            $turnHost = env('TURN_HOST', request()->getHost());
            $turnPort = env('TURN_PORT', '3478');
            $useTls = filter_var(env('TURN_TLS', false), FILTER_VALIDATE_BOOLEAN);
            $scheme = $useTls ? 'turns' : 'turn';

            $iceServers = [
                [
                    'urls' => ["stun:{$turnHost}:{$turnPort}"],
                ],
                [
                    'urls' => ["{$scheme}:{$turnHost}:{$turnPort}?transport=udp", "{$scheme}:{$turnHost}:{$turnPort}?transport=tcp"],
                    'username' => $username,
                    'credential' => $password,
                ],
            ];

            return response()->json(['iceServers' => $iceServers, 'ttl' => $ttl]);
        } catch (\Throwable $e) {
            Log::error('turnCredentials error', ['exception' => $e, 'room' => $room, 'user_id' => $user->id]);
            return response()->json(['message' => 'Internal server error while generating TURN credentials'], 500);
        }
    }
}
