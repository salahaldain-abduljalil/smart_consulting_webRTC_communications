<?php

namespace Database\Factories;

use App\Models\ConsultationRequest;
use App\Models\ConsultationSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ConsultationSession>
 */
class ConsultationSessionFactory extends Factory
{
    protected $model = ConsultationSession::class;
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'consultation_request_id' => ConsultationRequest::factory(),
            'advisor_id' => User::factory()->advisor(),
            'scheduled_at' => now()->addDays(rand(1, 10)),
            'confirmed_at' => null,
            'status' => 'scheduled',
            'meeting_id' => uniqid('meet_', true),
            'report' => null,
        ];
    }
}
