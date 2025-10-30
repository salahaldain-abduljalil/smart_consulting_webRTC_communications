<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('webrtc.{room}', function ($user, string $room) {
    // Basic presence auth; allow any authenticated user to join the room
    return ['id' => $user->id, 'name' => $user->name];
});



