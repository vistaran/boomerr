<?php

use App\Models\User;

function isCompanyAdminOrOwner(User $user): bool
{
    return in_array($user->role, ['owner', 'admin']);
}
