<?php

namespace Database\Factories;

use App\Models\AdvisorAvailability;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AdvisorAvailability>
 */
class AdvisorAvailabilityFactory extends Factory
{
    protected $model = AdvisorAvailability::class;
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = now()->addDays(rand(0, 14))->setTime(rand(9, 16), [0,30][rand(0,1)]);
        return [
            'advisor_id' => User::factory()->advisor(),
            'starts_at' => $start,
            'ends_at' => (clone $start)->addHour(),
            'is_blocked' => false,
        ];
    }
}
