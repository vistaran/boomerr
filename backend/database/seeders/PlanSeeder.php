<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Plan;
use App\Models\PlanPrice;
use App\Models\PlanGatewayMapping;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        /*
        |--------------------------------------------------------------------------
        | FREE PLAN
        |--------------------------------------------------------------------------
        */

        $free = Plan::updateOrCreate(
            ['code' => 'free'],
            [
                'name' => 'Free',
                'max_domains' => 10,
                'max_team_members' => 0,
                'max_status_pages' => 1,
                'is_active' => true,
            ]
        );

        PlanPrice::updateOrCreate(
            ['plan_id' => $free->id, 'interval' => 'monthly', 'currency' => 'USD'],
            ['price' => 0]
        );

        PlanPrice::updateOrCreate(
            ['plan_id' => $free->id, 'interval' => 'monthly', 'currency' => 'INR'],
            ['price' => 0]
        );

        /*
        |--------------------------------------------------------------------------
        | STARTER PLAN
        |--------------------------------------------------------------------------
        */

        $starter = Plan::updateOrCreate(
            ['code' => 'starter'],
            [
                'name' => 'Starter',
                'max_domains' => 10,
                'max_team_members' => 0,
                'max_status_pages' => 3,
                'is_active' => true,
            ]
        );

        // USD
        $starterMonthly = PlanPrice::updateOrCreate(
            ['plan_id' => $starter->id, 'interval' => 'monthly', 'currency' => 'USD'],
            ['price' => 500] // $5
        );

        $starterYearly = PlanPrice::updateOrCreate(
            ['plan_id' => $starter->id, 'interval' => 'yearly', 'currency' => 'USD'],
            ['price' => 5000] // $50
        );

        // INR
        $starterMonthlyINR = PlanPrice::updateOrCreate(
            ['plan_id' => $starter->id, 'interval' => 'monthly', 'currency' => 'INR'],
            ['price' => 45000] // ₹450
        );

        $starterYearlyINR = PlanPrice::updateOrCreate(
            ['plan_id' => $starter->id, 'interval' => 'yearly', 'currency' => 'INR'],
            ['price' => 450000] // ₹4500
        );

        /*
        |--------------------------------------------------------------------------
        | SOLOPRENEUR PLAN
        |--------------------------------------------------------------------------
        */

        $solopreneur = Plan::updateOrCreate(
            ['code' => 'solopreneur'],
            [
                'name' => 'Solopreneur',
                'max_domains' => 30,
                'max_team_members' => 1,
                'max_status_pages' => 5,
                'is_active' => true,
            ]
        );

        // USD
        $solopreneurMonthly = PlanPrice::updateOrCreate(
            ['plan_id' => $solopreneur->id, 'interval' => 'monthly', 'currency' => 'USD'],
            ['price' => 3000] // $30
        );

        $solopreneurYearly = PlanPrice::updateOrCreate(
            ['plan_id' => $solopreneur->id, 'interval' => 'yearly', 'currency' => 'USD'],
            ['price' => 30000] // $300
        );

        // INR
        $solopreneurMonthlyINR = PlanPrice::updateOrCreate(
            ['plan_id' => $solopreneur->id, 'interval' => 'monthly', 'currency' => 'INR'],
            ['price' => 273000] // $30
        );

        $solopreneurYearlyINR = PlanPrice::updateOrCreate(
            ['plan_id' => $solopreneur->id, 'interval' => 'yearly', 'currency' => 'INR'],
            ['price' => 2730000] // $300
        );

        /*
        |--------------------------------------------------------------------------
        | TEAMS PLAN
        |--------------------------------------------------------------------------
        */

        $teams = Plan::updateOrCreate(
            ['code' => 'teams'],
            [
                'name' => 'Teams',
                'max_domains' => 100,
                'max_team_members' => 10,
                'max_status_pages' => 10,
                'is_active' => true,
            ]
        );

        // USD
        $teamsMonthly = PlanPrice::updateOrCreate(
            ['plan_id' => $teams->id, 'interval' => 'monthly', 'currency' => 'USD'],
            ['price' => 10000] // $100
        );

        $teamsYearly = PlanPrice::updateOrCreate(
            ['plan_id' => $teams->id, 'interval' => 'yearly', 'currency' => 'USD'],
            ['price' => 100000] // $1000
        );

        // INR
        $teamsMonthlyINR = PlanPrice::updateOrCreate(
            ['plan_id' => $teams->id, 'interval' => 'monthly', 'currency' => 'INR'],
            ['price' => 900000] // $100
        );

        $teamsYearlyINR = PlanPrice::updateOrCreate(
            ['plan_id' => $teams->id, 'interval' => 'yearly', 'currency' => 'INR'],
            ['price' => 9000000] // $1000
        );

        /*
        |--------------------------------------------------------------------------
        | ENTERPRISE PLAN (CONTACT SALES)
        |--------------------------------------------------------------------------
        */

        $enterprise = Plan::updateOrCreate(
            ['code' => 'enterprise'],
            [
                'name' => 'Enterprise',
                'max_domains' => null, // unlimited
                'max_team_members' => null,
                'max_status_pages' => null,
                'is_active' => true,
            ]
        );

        // Optional price rows (not mapped to gateway)
        // USD
        PlanPrice::updateOrCreate(
            ['plan_id' => $enterprise->id, 'interval' => 'monthly', 'currency' => 'USD'],
            ['price' => 0]
        );

        PlanPrice::updateOrCreate(
            ['plan_id' => $enterprise->id, 'interval' => 'yearly', 'currency' => 'USD'],
            ['price' => 0]
        );

        // INR
        PlanPrice::updateOrCreate(
            ['plan_id' => $enterprise->id, 'interval' => 'monthly', 'currency' => 'INR'],
            ['price' => 0]
        );

        PlanPrice::updateOrCreate(
            ['plan_id' => $enterprise->id, 'interval' => 'yearly', 'currency' => 'INR'],
            ['price' => 0]
        );

        /*
        |--------------------------------------------------------------------------
        | RAZORPAY PLAN MAPPINGS
        |--------------------------------------------------------------------------
        */

        $gateway = 'razorpay';

        $mappings = [
            // Starter
            [
                'plan_price_id' => $starterMonthly->id,
                'gateway' => $gateway,
                'gateway_plan_id' => env('RAZORPAY_PLAN_STARTER_MONTHLY_USD', 'plan_TPDGq1yoLSHTtP'),
            ],
            [
                'plan_price_id' => $starterYearly->id,
                'gateway' => $gateway,
                'gateway_plan_id' => env('RAZORPAY_PLAN_STARTER_YEARLY_USD', 'plan_TPDMEo2sV148CH'),
            ],

            // Starter INR
            [
                'plan_price_id' => $starterMonthlyINR->id,
                'gateway' => $gateway,
                'gateway_plan_id' => env('RAZORPAY_PLAN_STARTER_MONTHLY_INR', 'plan_TPDKoXvmnRxIMV'),
            ],
            [
                'plan_price_id' => $starterYearlyINR->id,
                'gateway' => $gateway,
                'gateway_plan_id' => env('RAZORPAY_PLAN_STARTER_YEARLY_INR', 'plan_TPDN1oiKbm0H4X'),
            ],

            // Solopreneur
            [
                'plan_price_id' => $solopreneurMonthly->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SGnoZUkwb2pz9M',
            ],
            [
                'plan_price_id' => $solopreneurYearly->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SGoU9mVnPC6M0K',
            ],

            // Solopreneur INR
            [
                'plan_price_id' => $solopreneurMonthlyINR->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SVo5hA6xAiImHD',
            ],
            [
                'plan_price_id' => $solopreneurYearlyINR->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SVo8G9kEvHAiyG',
            ],

            // Teams
            [
                'plan_price_id' => $teamsMonthly->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SGnoskBNhS2UPx',
            ],
            [
                'plan_price_id' => $teamsYearly->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SGoUfMZPxjY6S0',
            ],

            // Teams INR
            [
                'plan_price_id' => $teamsMonthlyINR->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SVo6679eRbvMpB',
            ],
            [
                'plan_price_id' => $teamsYearlyINR->id,
                'gateway' => $gateway,
                'gateway_plan_id' => 'plan_SVo8bhdzSH1jRk',
            ],
        ];

        foreach ($mappings as $mapping) {
            PlanGatewayMapping::updateOrCreate(
                [
                    'plan_price_id' => $mapping['plan_price_id'],
                    'gateway' => $mapping['gateway'],
                ],
                [
                    'gateway_plan_id' => $mapping['gateway_plan_id'],
                ]
            );
        }
    }
}
