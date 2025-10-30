<?php

namespace Database\Factories;

use App\Models\ConsultationRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ConsultationRequest>
 */
class ConsultationRequestFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
  protected $model = ConsultationRequest::class;


    public function definition(): array
    {

        return [
            'client_id' => User::factory()->client(),
            'category' => $this->faker->randomElement(['legal', 'finance', 'it', 'marketing']),
            'purpose' => $this->faker->sentence(),
            'questionnaire' => [
                'background' => $this->faker->paragraph(),
                'goals' => $this->faker->sentence(),
            ],
            'status' => 'pending',
        ];
    }
}
