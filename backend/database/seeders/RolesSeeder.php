<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            ['name' => 'owner', 'label' => 'Owner'],
            ['name' => 'admin', 'label' => 'Admin'],
            ['name' => 'member', 'label' => 'Member'],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(
                ['workspace_id' => 0, 'name' => $role['name']],
                ['label' => $role['label']]
            );
        }
    }
}
