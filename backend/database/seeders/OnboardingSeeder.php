<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OnboardingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        // 1. onboarding_plans
        DB::table('onboarding_plans')->truncate();
        DB::table('onboarding_plans')->insert([
            [
                'plan_id' => 'personal',
                'label' => 'Personal / Side Project',
                'description' => 'For 1-2 domains',
                'icon' => 'User',
                'color' => 'bg-blue-500/10 text-blue-400',
                'sort_order' => 1,
                'created_at' => now(), 'updated_at' => now()
            ],
            [
                'plan_id' => 'growth',
                'label' => 'Growth / Business',
                'description' => 'For agencies & startups',
                'icon' => 'TrendingUp',
                'color' => 'bg-emerald-500/10 text-emerald-400',
                'sort_order' => 2,
                'created_at' => now(), 'updated_at' => now()
            ],
            [
                'plan_id' => 'enterprise',
                'label' => 'Enterprise / SaaS',
                'description' => 'White-label & team seats',
                'icon' => 'Shield',
                'color' => 'bg-purple-500/10 text-purple-400',
                'sort_order' => 3,
                'created_at' => now(), 'updated_at' => now()
            ],
        ]);

        // 2. onboarding_company_sizes
        DB::table('onboarding_company_sizes')->truncate();
        DB::table('onboarding_company_sizes')->insert([
            ['size_id' => 'just_me', 'label' => 'Just me', 'range' => '1', 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['size_id' => 'small', 'label' => '2-10 employees', 'range' => '2-10', 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['size_id' => 'medium', 'label' => '11-50 employees', 'range' => '11-50', 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['size_id' => 'large', 'label' => '51-200 employees', 'range' => '51-200', 'sort_order' => 4, 'created_at' => now(), 'updated_at' => now()],
            ['size_id' => 'enterprise', 'label' => '201+ employees', 'range' => '201+', 'sort_order' => 5, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 3. onboarding_sources
        DB::table('onboarding_sources')->truncate();
        DB::table('onboarding_sources')->insert([
            ['source_id' => 'google', 'label' => 'Google Search', 'icon' => 'Search', 'color' => 'bg-red-500/10 text-red-500', 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['source_id' => 'twitter', 'label' => 'Twitter / X', 'icon' => 'Twitter', 'color' => 'bg-sky-500/10 text-sky-500', 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['source_id' => 'instagram', 'label' => 'Instagram', 'icon' => 'Instagram', 'color' => 'bg-pink-500/10 text-pink-500', 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['source_id' => 'linkedin', 'label' => 'LinkedIn', 'icon' => 'Linkedin', 'color' => 'bg-blue-500/10 text-blue-600', 'sort_order' => 4, 'created_at' => now(), 'updated_at' => now()],
            ['source_id' => 'friend', 'label' => 'Friend / Colleague', 'icon' => 'Users', 'color' => 'bg-green-500/10 text-green-500', 'sort_order' => 5, 'created_at' => now(), 'updated_at' => now()],
            ['source_id' => 'other', 'label' => 'Other', 'icon' => 'MoreHorizontal', 'color' => 'bg-slate-500/10 text-slate-400', 'sort_order' => 6, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 4. onboarding_features
        DB::table('onboarding_features')->truncate();
        DB::table('onboarding_features')->insert([
            ['label' => 'Uptime Monitoring', 'icon' => 'Activity', 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['label' => 'SSL Certificate Tracking', 'icon' => 'Lock', 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['label' => 'Domain Blacklist Check', 'icon' => 'ShieldAlert', 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['label' => 'Speed Audits', 'icon' => 'Gauge', 'sort_order' => 4, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 5. onboarding_highlights
        DB::table('onboarding_highlights')->truncate();
        DB::table('onboarding_highlights')->insert([
            ['title' => 'Peace of Mind', 'description' => 'We monitor you 24/7', 'icon' => 'Shield', 'color' => 'text-emerald-500', 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['title' => 'Instant Alerts', 'description' => 'Get notified via Slack, SMS', 'icon' => 'Bell', 'color' => 'text-amber-500', 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 6. onboarding_suggestions
        DB::table('onboarding_suggestions')->truncate();
        DB::table('onboarding_suggestions')->insert([
            ['label' => 'Connect Slack', 'icon' => 'BellRing', 'color' => 'bg-indigo-500/10 text-indigo-400', 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['label' => 'Ad protection', 'icon' => 'ShieldAlert', 'color' => 'bg-red-500/10 text-red-500', 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['label' => 'New domain', 'icon' => 'PlusCircle', 'color' => 'bg-emerald-500/10 text-emerald-400', 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 7. onboarding_environments
        DB::table('onboarding_environments')->truncate();
        DB::table('onboarding_environments')->insert([
            [
                'value' => 'Production',
                'label' => 'Production',
                'icon' => 'Rocket',
                'description' => 'Live environment',
                'color' => 'text-emerald-400',
                'bg_color' => 'bg-emerald-500/10',
                'border_color' => 'border-emerald-500/20',
                'sort_order' => 1,
                'created_at' => now(), 'updated_at' => now()
            ],
            [
                'value' => 'Staging',
                'label' => 'Staging',
                'icon' => 'GitBranch',
                'description' => 'Pre-release testing',
                'color' => 'text-amber-400',
                'bg_color' => 'bg-amber-500/10',
                'border_color' => 'border-amber-500/20',
                'sort_order' => 2,
                'created_at' => now(), 'updated_at' => now()
            ],
            [
                'value' => 'Development',
                'label' => 'Development',
                'icon' => 'Server',
                'description' => 'Local dev environment',
                'color' => 'text-blue-400',
                'bg_color' => 'bg-blue-500/10',
                'border_color' => 'border-blue-500/20',
                'sort_order' => 3,
                'created_at' => now(), 'updated_at' => now()
            ],
        ]);

        Schema::enableForeignKeyConstraints();
    }
}
