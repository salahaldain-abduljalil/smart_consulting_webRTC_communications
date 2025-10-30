@extends('layouts.app')

@section('content')
<div class="max-w-6xl mx-auto p-6">
    <h1 class="text-2xl font-semibold mb-4">My Sessions</h1>
    <div class="bg-white border rounded divide-y">
        @forelse($sessions as $s)
        <div class="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <div>
                <div class="text-sm text-gray-500">Client</div>
                <div class="font-medium">{{ $s->request->client->name }}</div>
            </div>
            <div>
                <div class="text-sm text-gray-500">When</div>
                <div class="font-medium">{{ optional($s->scheduled_at)->format('Y-m-d H:i') }}</div>
            </div>
            <div>
                <div class="text-sm text-gray-500">Status</div>
                <div class="font-medium">{{ $s->status }}</div>
            </div>
            <div class="md:col-span-2 text-right">
                <a href="{{ route('advisor.sessions.show', $s) }}" class="text-blue-600">Open</a>
            </div>
        </div>
        @empty
        <div class="p-6 text-gray-500">No sessions.</div>
        @endforelse
    </div>
    <div class="mt-4">{{ $sessions->links() }}</div>
</div>
@endsection



