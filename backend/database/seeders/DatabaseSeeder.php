<?php

namespace Database\Seeders;

use App\Models\User;
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
        // User::factory(10)->create();

        // User::factory()->create([
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        // ]);

        // Seed base roles required for multi-company pivot
        $this->call(RolesSeeder::class);
        $this->call(PlanSeeder::class);
        $this->call(OnboardingSeeder::class);
        $this->call(MonitoringRegionSeeder::class);
        $this->call(EmailTemplateSeeder::class);
        // Optional demo data
        // if (class_exists(\Database\Seeders\DemoDataSeeder::class)) {
        //     $this->call(DemoDataSeeder::class);
        // }
    }
}
