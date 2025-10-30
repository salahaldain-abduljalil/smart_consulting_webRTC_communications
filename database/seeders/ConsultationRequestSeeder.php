<?php

namespace Database\Seeders;

use App\Models\ConsultationRequest;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ConsultationRequestSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
            $clients = User::all();

        foreach ($clients as $client) {
            ConsultationRequest::factory()->count(5)->create([
                'client_id' => $client->id,
            ]);
        }
    }
}
