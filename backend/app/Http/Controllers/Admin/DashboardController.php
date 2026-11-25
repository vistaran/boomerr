<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Domain;
use App\Models\Subscription;
use App\Models\Incident;
use App\Models\SystemLog;
use App\Models\AuditLog;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $totalUsers = User::count();
        $activeDomains = Domain::where('is_active', true)->count();
        $activeSubscriptions = Subscription::where('status', 'active')->count();
        $activeIncidents = Incident::where('status', '!=', 'resolved')->count();
        
        $recentUsers = User::orderBy('created_at', 'desc')->take(5)->get();
        
        // Ensure AuditLog class exists, else fallback to empty array or skip
        $recentActivities = class_exists(AuditLog::class) 
            ? AuditLog::with('actor')->orderBy('created_at', 'desc')->take(10)->get() 
            : [];
            
        $latestErrors = class_exists(SystemLog::class) 
            ? SystemLog::where(function ($q) {
                $q->where('severity', 'error')
                  ->orWhere('severity', 'critical')
                  ->orWhere('execution_status', 'failure')
                  ->orWhere('log_type', 'error');
            })->orderBy('created_at', 'desc')->take(5)->get() 
            : [];

        return response()->json([
            'stats' => [
                'total_users' => $totalUsers,
                'active_domains' => $activeDomains,
                'active_subscriptions' => $activeSubscriptions,
                'active_incidents' => $activeIncidents,
            ],
            'recent_users' => $recentUsers,
            'recent_activities' => $recentActivities,
            'latest_errors' => $latestErrors,
        ]);
    }
}
