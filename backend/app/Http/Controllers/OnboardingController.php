<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OnboardingController extends Controller
{
    /**
     * Get onboarding data from the database
     */
    public function getOnboardingData(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof User) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthenticated'
            ], 401);
        }

        $onboardingSettings = array_merge(
            $this->getDefaultOnboardingData(),
            $this->resolveExistingOnboardingData($user)
        );

        return response()->json([
            'status' => 'success',
            'data' => $onboardingSettings
        ]);
    }

    /**
     * Save onboarding data to the database
     */
    public function saveOnboardingData(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof User) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthenticated'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'welcome_highlights' => 'nullable|array',
            'company_sizes' => 'nullable|array',
            'hear_about_sources' => 'nullable|array',
            'usage_plans' => 'nullable|array',
            'environment_options' => 'nullable|array',
            'monitoring_features' => 'nullable|array',
            'suggestions' => 'nullable|array',
            'selections' => 'nullable|array',
            'onboarding_completed' => 'nullable|boolean',
            'dashboard_tour_completed' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $onboardingData = $request->only([
            'welcome_highlights',
            'company_sizes',
            'hear_about_sources',
            'usage_plans',
            'environment_options',
            'monitoring_features',
            'suggestions',
            'selections',
            'onboarding_completed',
            'dashboard_tour_completed'
        ]);

        // Merge with existing data
        $existingData = $this->resolveExistingOnboardingData($user);
        
        // Merge selections specifically to avoid overwriting the whole selections array
        if (isset($onboardingData['selections']) && isset($existingData['selections'])) {
            $onboardingData['selections'] = array_merge($existingData['selections'], $onboardingData['selections']);
        }

        $mergedData = array_merge($existingData, $onboardingData);

        $wasCompleted = $existingData['onboarding_completed'] ?? false;
        $isCompleted = $mergedData['onboarding_completed'] ?? false;

        $user->onboarding_settings = $mergedData;
        $user->save();

        // Dispatch lifecycle event when onboarding is completed for the first time
        if (!$wasCompleted && $isCompleted) {
            $lifecycleService = app(\App\Services\LifecycleEventService::class);
            $lifecycleService->dispatch($user, 'onboarding_completed', $mergedData);
            
            \App\Jobs\ProcessLifecycleAutomations::dispatch($user);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Onboarding data saved successfully',
            'data' => $mergedData
        ]);
    }

    /**
     * Get default onboarding data (static data to use as fallback)
     */
    private function getDefaultOnboardingData()
    {


        return [
            'welcome_highlights' => \Illuminate\Support\Facades\DB::table('onboarding_highlights')
                ->where('is_active', 1)
                ->orderBy('sort_order', 'asc')
                ->get()
                ->map(function ($highlight) {
                    return [
                        'title' => $highlight->title,
                        'description' => $highlight->description,
                        'icon' => $highlight->icon,
                        'color' => $highlight->color
                    ];
                })
                ->toArray(),
            'company_sizes' => \Illuminate\Support\Facades\DB::table('onboarding_company_sizes')
                ->where('is_active', 1)
                ->orderBy('sort_order', 'asc')
                ->get()
                ->map(function ($size) {
                    return [
                        'id' => $size->size_id,
                        'label' => $size->label,
                        'range' => $size->range
                    ];
                })
                ->toArray(),
            'hear_about_sources' => \Illuminate\Support\Facades\DB::table('onboarding_sources')
                ->where('is_active', 1)
                ->orderBy('sort_order', 'asc')
                ->get()
                ->map(function ($source) {
                    return [
                        'id' => $source->source_id,
                        'label' => $source->label,
                        'icon' => $source->icon,
                        'color' => $source->color
                    ];
                })
                ->toArray(),
            'usage_plans' => \Illuminate\Support\Facades\DB::table('onboarding_plans')
                ->where('is_active', 1)
                ->orderBy('sort_order', 'asc')
                ->get()
                ->map(function ($plan) {
                    return [
                        'id' => $plan->plan_id,
                        'label' => $plan->label,
                        'desc' => $plan->description ?? '',
                        'icon' => $plan->icon,
                        'color' => $plan->color
                    ];
                })
                ->toArray(),
            'environment_options' => [
                ['value' => 'Production', 'label' => 'Production', 'icon' => 'Rocket', 'desc' => 'Live environment', 'color' => 'text-emerald-400', 'bg' => 'bg-emerald-500/10', 'border' => 'border-emerald-500/20'],
                ['value' => 'Staging', 'label' => 'Staging', 'icon' => 'GitBranch', 'desc' => 'Pre-release testing', 'color' => 'text-amber-400', 'bg' => 'bg-amber-500/10', 'border' => 'border-amber-500/20'],
                ['value' => 'Development', 'label' => 'Development', 'icon' => 'Server', 'desc' => 'Local dev environment', 'color' => 'text-blue-400', 'bg' => 'bg-blue-500/10', 'border' => 'border-blue-500/20']
            ],
            'monitoring_features' => \Illuminate\Support\Facades\DB::table('onboarding_features')
                ->where('is_active', 1)
                ->orderBy('sort_order', 'asc')
                ->get()
                ->map(function ($feature) {
                    return [
                        'label' => $feature->label,
                        'icon' => $feature->icon
                    ];
                })
                ->toArray(),
            'suggestions' => \Illuminate\Support\Facades\DB::table('onboarding_suggestions')
                ->where('is_active', 1)
                ->orderBy('sort_order', 'asc')
                ->get()
                ->map(function ($suggestion) {
                    return [
                        'label' => $suggestion->label,
                        'icon' => $suggestion->icon,
                        'color' => $suggestion->color
                    ];
                })
                ->toArray(),
        ];
    }

    /**
     * Resolve onboarding state from user first, and fall back to legacy workspace data.
     */
    private function resolveExistingOnboardingData(User $user): array
    {
        $userSettings = $user->onboarding_settings;
        if (is_array($userSettings) && !empty($userSettings)) {
            return $userSettings;
        }

        $workspaceSettings = $user->currentWorkspace()?->onboarding_settings;
        if (is_array($workspaceSettings)) {
            return $workspaceSettings;
        }

        return [];
    }
}
