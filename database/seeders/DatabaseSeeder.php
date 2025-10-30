<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\ConsultationRequest;
use App\Models\ConsultationSession;
use App\Models\AdvisorAvailability;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $supervisors = User::factory(2)->supervisor()->create();
        $advisors = User::factory(5)->advisor()->create();
        $clients = User::factory(20)->client()->create();

        foreach ($advisors as $advisor) {
            AdvisorAvailability::factory(6)->create(['advisor_id' => $advisor->id]);
        }

        $requests = ConsultationRequest::factory(30)->create();

        $requests->take(15)->each(function (ConsultationRequest $req) use ($advisors) {
            $advisor = $advisors->random();
            ConsultationSession::factory()->create([
                'consultation_request_id' => $req->id,
                'advisor_id' => $advisor->id,
            ]);
            $req->update(['status' => 'scheduled']);
        });

        // Optionally create a known login
        // User::factory()->client()->create(['email' => 'client@example.com']);
    }
}
