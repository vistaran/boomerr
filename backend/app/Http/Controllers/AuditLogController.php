<?php

namespace App\Http\Controllers;

use App\Http\Resources\AuditLogResource;
use App\Models\User;
use App\Queries\AuditLogQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            if (! $user instanceof User) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $perPage = min(100, max(5, $request->integer('per_page', 25)));

            return AuditLogResource::collection(
                AuditLogQuery::base($user, $request)->paginate($perPage)
            );
        } catch (\Throwable $e) {
            Log::error('AuditLogController index failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load audit logs'], 500);
        }
    }
}
