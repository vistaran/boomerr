<?php

namespace App\Services\Billing;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TrialService
{
    public function hasConsumedTrial(User $user): bool
    {
        return $user->trial_consumed_at !== null;
    }

    public function trialEndsAtIfEligible(User $user, int $trialDays = 14): ?Carbon
    {
        if ($this->hasConsumedTrial($user)) {
            return null;
        }

        return now()->addDays($trialDays);
    }

    public function consumeTrialIfEligible(User $user, int $trialDays = 14): ?Carbon
    {
        $lockedUser = User::query()
            ->whereKey($user->id)
            ->lockForUpdate()
            ->first();

        if (!$lockedUser) {
            return null;
        }

        if ($lockedUser->trial_consumed_at) {
            return null;
        }

        $lockedUser->forceFill([
            'trial_consumed_at' => now(),
        ])->save();

        return now()->addDays($trialDays);
    }

    public function consumeTrialForWorkspaceOwnersIfEligible(Workspace $workspace): int
    {
        return DB::transaction(function () use ($workspace): int {
            $ownerIds = $workspace->users()
                ->wherePivot('role', User::ROLE_OWNER)
                ->pluck('users.id')
                ->all();

            if (empty($ownerIds)) {
                return 0;
            }

            return User::query()
                ->whereIn('id', $ownerIds)
                ->whereNull('trial_consumed_at')
                ->lockForUpdate()
                ->update(['trial_consumed_at' => now()]);
        });
    }
}
