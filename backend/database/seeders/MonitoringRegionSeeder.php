<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\MonitoringRegion;

class MonitoringRegionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $regions = [
            ['name' => 'Mumbai (India)', 'aws_region' => 'ap-south-1', 'lambda_function_name' => 'boomerr-monitor'],
            ['name' => 'US East (Virginia)', 'aws_region' => 'us-east-1', 'lambda_function_name' => 'boomerr-monitor-us-east-1'],
            ['name' => 'US West (Oregon)', 'aws_region' => 'us-west-2', 'lambda_function_name' => 'boomerr-monitor-us-west-2'],
            ['name' => 'Germany (Frankfurt)', 'aws_region' => 'eu-central-1', 'lambda_function_name' => 'boomerr-monitor-eu-central-1'],
            ['name' => 'Cape Town (South Africa)', 'aws_region' => 'af-south-1', 'lambda_function_name' => 'boomerr-monitor-af-south-1'],
            ['name' => 'Bahrain (Middle East)', 'aws_region' => 'me-south-1', 'lambda_function_name' => 'boomerr-monitor-me-south-1'],
        ];

        foreach ($regions as $region) {
            MonitoringRegion::updateOrCreate(
                ['aws_region' => $region['aws_region']],
                [
                    'name' => $region['name'],
                    'lambda_function_name' => $region['lambda_function_name'],
                    'is_active' => true,
                ]
            );
        }
    }
}
