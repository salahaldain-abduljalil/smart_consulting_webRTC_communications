<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Http\Requests\ScheduleSessionRequest;
use App\Models\ConsultationRequest;
use App\Models\ConsultationSession;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class ConsultationTriageController extends Controller
{
    public function index(): View
    {
        $requests = ConsultationRequest::query()
            ->with('client')
            ->where('status', 'pending')
            ->latest()
            ->paginate(20);

        return view('supervisor.consultations.index', compact('requests'));
    }

    public function schedule(ScheduleSessionRequest $request): RedirectResponse
    {
        $consultation = ConsultationRequest::query()->findOrFail($request->validated('consultation_request_id'));

        $session = ConsultationSession::query()->create([
            'consultation_request_id' => $consultation->id,
            'advisor_id' => (int) $request->validated('advisor_id'),
            'scheduled_at' => $request->date('scheduled_at'),
            'status' => 'scheduled',
            'meeting_id' => uniqid('meet_', true),
        ]);

        $consultation->update(['status' => 'scheduled']);

        // TODO: dispatch notifications

        return redirect()->route('supervisor.consultations.index');
    }
}
