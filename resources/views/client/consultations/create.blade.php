@extends('layouts.app')

@section('content')
    <div class="max-w-3xl mx-auto p-6">
        <h1 class="text-2xl font-semibold mb-6">New Consultation</h1>
        <form method="POST" action="{{ route('client.consultations.store') }}" class="space-y-4">
            @csrf
            <div>
                <label class="block text-sm font-medium">Category</label>
                <input name="category" class="mt-1 w-full border rounded px-3 py-2" required />
                @error('category')
                    <p class="text-red-600 text-sm">{{ $message }}</p>
                @enderror
            </div>
            <div>
                <label class="block text-sm font-medium">Purpose</label>
                <input name="purpose" class="mt-1 w-full border rounded px-3 py-2" required />
                @error('purpose')
                    <p class="text-red-600 text-sm">{{ $message }}</p>
                @enderror
            </div>
            <div>
                <label class="block text-sm font-medium">Questionnaire (JSON)</label>
                <textarea name="questionnaire" class="mt-1 w-full border rounded px-3 py-2" rows="6" placeholder='{"q1":"answer"}'
                    required></textarea>
                @error('questionnaire')
                    <p class="text-red-600 text-sm">{{ $message }}</p>
                @enderror
            </div>
            <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Submit</button>
        </form>
        <p class="text-gray-500 text-sm mt-4">Note: For now, paste questionnaire as JSON. We'll upgrade to dynamic fields.
        </p>
        <script>
            document.querySelector('form').addEventListener('submit', function(e) {
                try {
                    const t = this.querySelector('textarea[name="questionnaire"]');
                    const obj = JSON.parse(t.value);
                    const hidden = document.createElement('input');
                    hidden.type = 'hidden';
                    hidden.name = 'questionnaire';
                    hidden.value = JSON.stringify(obj);
                    t.parentNode.appendChild(hidden);
                } catch (err) {
                    e.preventDefault();
                    alert('Questionnaire must be valid JSON.');
                }
            });
        </script>
    </div>
@endsection
