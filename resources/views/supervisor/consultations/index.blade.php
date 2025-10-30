@extends('layouts.app')

@section('content')
<div class="max-w-6xl mx-auto p-6">
    <h1 class="text-2xl font-semibold mb-4">Pending Consultations</h1>
    <div class="bg-white border rounded divide-y">
        @forelse($requests as $req)
        <div class="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <div>
                <div class="text-sm text-gray-500">Client</div>
                <div class="font-medium">{{ $req->client->name }}</div>
            </div>
            <div>
                <div class="text-sm text-gray-500">Category</div>
                <div class="font-medium">{{ $req->category }}</div>
            </div>
            <div class="md:col-span-2">
                <div class="text-sm text-gray-500">Purpose</div>
                <div class="truncate">{{ $req->purpose }}</div>
            </div>
            <div>
                <form method="POST" action="{{ route('supervisor.consultations.schedule') }}" class="flex items-center gap-2">
                    @csrf
                    <input type="hidden" name="consultation_request_id" value="{{ $req->id }}" />
                    <input name="advisor_id" type="number" class="border rounded px-2 py-1 w-24" placeholder="Advisor" required />
                    <input name="scheduled_at" type="datetime-local" class="border rounded px-2 py-1" required />
                    <button class="bg-blue-600 text-white px-3 py-1 rounded">Schedule</button>
                </form>
            </div>
        </div>
        @empty
        <div class="p-6 text-gray-500">No pending requests.</div>
        @endforelse
    </div>
    <div class="mt-4">{{ $requests->links() }}</div>
</div>
@endsection



