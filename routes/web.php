<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Client\ConsultationRequestController;
use App\Http\Controllers\Supervisor\ConsultationTriageController;
use App\Http\Controllers\Advisor\SessionController as AdvisorSessionController;
use App\Http\Controllers\MeetingController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Public meeting creation and join (creates a UUID and redirects to the meeting page)
Route::get('/meetings/create', [MeetingController::class, 'create'])->name('meetings.create');
Route::get('/meeting/{room}', [MeetingController::class, 'show'])->name('meeting.show');
// Health check (public) — quick diagnostics for SFU/TURN environment
Route::get('/health', [\App\Http\Controllers\HealthController::class, 'index'])->name('health');

// Meeting occupancy API (acquire/release slot for room). Requires auth.
// These endpoints require authentication: move them into the auth middleware group further below.

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth'])->group(function () {
    // Client
    Route::middleware('role:client')->group(function () {
        Route::get('/client/consultations/create', [ConsultationRequestController::class, 'create'])->name('client.consultations.create');
        Route::post('/client/consultations', [ConsultationRequestController::class, 'store'])->name('client.consultations.store');
        Route::get('/client/consultations/{consultation}', [ConsultationRequestController::class, 'show'])->name('client.consultations.show');
    });

    // Supervisor
    Route::middleware('role:supervisor')->group(function () {
        Route::get('/supervisor/consultations', [ConsultationTriageController::class, 'index'])->name('supervisor.consultations.index');
        Route::post('/supervisor/consultations/schedule', [ConsultationTriageController::class, 'schedule'])->name('supervisor.consultations.schedule');
    });

    // Advisor
        Route::get('/advisor/sessions', [AdvisorSessionController::class, 'index'])->name('advisor.sessions.index');
        Route::get('/advisor/sessions/{session}', [AdvisorSessionController::class, 'show'])->name('advisor.sessions.show');
        Route::post('/advisor/sessions/{session}/report', [AdvisorSessionController::class, 'submitReport'])->name('advisor.sessions.report');
    // Signaling API
    Route::post('/signaling/send', [\App\Http\Controllers\SignalingController::class, 'send'])->name('signaling.send');

    // Meeting occupancy and support endpoints (require auth)
    Route::post('/meeting/{room}/acquire', [MeetingController::class, 'acquire'])->name('meeting.acquire');
    Route::post('/meeting/{room}/release', [MeetingController::class, 'release'])->name('meeting.release');
    Route::post('/meeting/{room}/heartbeat', [MeetingController::class, 'heartbeat'])->name('meeting.heartbeat');
    Route::post('/meeting/{room}/sfu-token', [MeetingController::class, 'sfuToken'])->name('meeting.sfu-token');
    Route::post('/meeting/{room}/turn-credentials', [MeetingController::class, 'turnCredentials'])->name('meeting.turn-credentials');
});

require __DIR__.'/auth.php';
