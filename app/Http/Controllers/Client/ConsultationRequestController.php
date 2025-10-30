<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreConsultationRequest as StoreConsultationForm;
use App\Models\ConsultationRequest;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class ConsultationRequestController extends Controller
{
     use AuthorizesRequests;
    public function create(): View
    {
        return view('client.consultations.create');
    }

    public function store(StoreConsultationForm $request): RedirectResponse
    {

        $consultation = ConsultationRequest::query()->create([
            'client_id' => $request->user()->id,
            'category' => $request->string('category'),
            'purpose' => $request->string('purpose'),
            'questionnaire' => $request->validated('questionnaire'),
            'status' => 'pending',
        ]);

        return redirect()->route('client.consultations.show', $consultation);
    }

    public function show(ConsultationRequest $consultation): View
    {

        return view('client.consultations.show', [
            'consultation' => $consultation->load('session'),
        ]);
    }
}
