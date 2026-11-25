<?php

namespace Database\Factories;

use App\Models\Domain;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Domain>
 */
class DomainFactory extends Factory
{
    protected $model = Domain::class;

    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->domainName(),
            'url' => 'https://' . fake()->domainName(),
            'environment' => 'production',
            'is_active' => true,
            'status' => 'up',
            'check_interval' => 1,
            'next_check_at' => null,
            'last_response_time_ms' => 120,
            'last_checked_at' => now(),
        ];
    }
}
