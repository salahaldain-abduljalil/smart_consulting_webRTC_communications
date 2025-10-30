<?php

namespace App\Http\Controllers;

use App\Events\SignalingMessageReceived;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SignalingController extends Controller
{
    public function send(Request $request): Response
    {
        $validated = $request->validate([
            'room' => ['required', 'string'],
            'payload' => ['required', 'array'],
        ]);

        broadcast(new SignalingMessageReceived($validated['room'], $validated['payload']))->toOthers();

        return response()->noContent();
    }
}
