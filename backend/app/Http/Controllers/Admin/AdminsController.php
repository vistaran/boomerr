<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Admin;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminsController extends Controller
{
    public function index(Request $request)
    {
        $admins = Admin::orderBy('created_at', 'desc')->get();
        return response()->json([
            'status' => 'success',
            'data' => $admins
        ]);
    }

    public function store(Request $request)
    {
        if (!$request->user()->tokenCan('admin')) {
            abort(403, 'Unauthorized action. You lack the required ability.');
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:admins',
            'password' => 'required|string|min:8',
        ]);

        $admin = Admin::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Admin created successfully',
            'data' => $admin
        ], 201);
    }

    public function show($id)
    {
        $admin = Admin::findOrFail($id);
        
        $lastActiveToken = $admin->tokens()->orderBy('last_used_at', 'desc')->first();
        $lastActive = $lastActiveToken && $lastActiveToken->last_used_at 
            ? $lastActiveToken->last_used_at->diffForHumans() 
            : 'Never';

        $totalLogins = $admin->tokens()->count();

        $startDate = now()->subDays(4)->startOfDay();
        $counts = \App\Models\SystemLog::where('actor_id', $admin->id)
            ->whereIn('actor_type', ['admin', \App\Models\Admin::class])
            ->where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, count(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        $chartData = [];
        for ($i = 4; $i >= 0; $i--) {
            $date = now()->subDays($i);
            $dateString = $date->toDateString();
            
            $chartData[] = [
                'time' => $date->format('M d, g:i A'),
                'actions' => $counts->get($dateString, 0)
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'admin' => $admin,
                'stats' => [
                    'account_status' => 'Active',
                    'total_logins' => $totalLogins,
                    'role' => 'Super Admin',
                    'last_active' => $lastActive
                ],
                'chart' => $chartData
            ]
        ]);
    }

    public function update(Request $request, $id)
    {
        if (!$request->user()->tokenCan('admin')) {
            abort(403, 'Unauthorized action. You lack the required ability.');
        }

        $admin = Admin::findOrFail($id);

        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|email|max:255|unique:admins,email,' . $admin->id,
            'password' => 'nullable|string|min:8',
        ]);

        $admin->name  = $request->name;
        $admin->email = $request->email;

        if (!empty($request->password)) {
            $admin->password = Hash::make($request->password);
        }

        $admin->save();

        return response()->json([
            'status'  => 'success',
            'message' => 'Admin updated successfully',
            'data'    => $admin,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        if (!$request->user()->tokenCan('admin')) {
            abort(403, 'Unauthorized action. You lack the required ability.');
        }

        $admin = Admin::findOrFail($id);

        // Prevent admin from deleting themselves
        if ($request->user()->id == $admin->id) {
            return response()->json([
                'status'  => 'error',
                'message' => 'You cannot delete your own admin account.',
            ], 422);
        }

        // Revoke all tokens for this admin
        $admin->tokens()->delete();
        $admin->delete();

        return response()->json([
            'status'  => 'success',
            'message' => 'Admin deleted successfully',
        ]);
    }
}
