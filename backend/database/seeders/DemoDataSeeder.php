<?php

namespace Database\Seeders;

use App\Models\Workspace as Company;
use App\Models\Domain;
use App\Models\Workspace;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $user = \App\Models\User::updateOrCreate(
            ['email' => 'user@boomerr.local'],
            [
                'name' => 'Demo User',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'email_verified_at' => now(),
                'failed_attempts' => 0,
                'blocked_until' => null,
            ]
        );

        $company = Workspace::firstOrCreate(
            ['slug' => 'demo-company'],
            [
                'name' => 'Demo Company',
                'primary_contact_email' => 'user@boomerr.local',
                'timezone' => 'UTC',
            ]
        );

        $user->workspaces()->syncWithoutDetaching([$company->id => ['role' => 'owner', 'is_current' => true]]);

        if ($company->domains()->count() === 0) {
            Domain::insert([
                [
                    'workspace_id' => $company->id,
                    'name' => 'example.com',
                    'url' => 'https://example.com',
                    'label' => 'Marketing Site',
                    'environment' => 'production',
                    'status' => 'up',
                    'last_response_time_ms' => 120,
                    'last_checked_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'workspace_id' => $company->id,
                    'name' => 'staging.example.com',
                    'url' => 'https://staging.example.com',
                    'label' => 'Staging',
                    'environment' => 'staging',
                    'status' => 'down',
                    'last_response_time_ms' => null,
                    'last_checked_at' => now()->subMinutes(5),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }
}
