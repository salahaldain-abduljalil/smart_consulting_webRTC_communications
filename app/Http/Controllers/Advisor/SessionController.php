<?php

namespace App\Http\Controllers\Advisor;

use App\Http\Controllers\Controller;
use App\Models\ConsultationSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class SessionController extends Controller
{
    public function index(): View
    {
        $sessions = ConsultationSession::query()
            ->with(['request.client'])
            ->where('advisor_id', auth()->id())
            ->latest('scheduled_at')
            ->paginate(20);

        return view('advisor.sessions.index', compact('sessions'));
    }

    public function show(ConsultationSession $session): View
    {
        return view('advisor.sessions.show', compact('session'));
    }

    public function submitReport(ConsultationSession $session): RedirectResponse
    {
        abort_unless($session->advisor_id === auth()->id(), 403);
        request()->validate(['report' => ['required', 'string']]);
        $session->update(['report' => request('report'), 'status' => 'completed']);
        return redirect()->route('advisor.sessions.index');
    }
}
