<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureWorkspaceAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if (! $user instanceof User) {
            abort(403, 'No access to this workspace');
        }

        $workspaceId = $user->currentWorkspaceId();

        if (! $workspaceId) {
            abort(403, 'No access to this workspace');
        }

        return $next($request);
    }
}
