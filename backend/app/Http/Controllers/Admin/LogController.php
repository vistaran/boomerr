<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\SystemLog;

use Illuminate\Pagination\LengthAwarePaginator;

use Illuminate\Support\Facades\DB;

class LogController extends Controller
{
    public function index(Request $request)
    {
        $systemLogs = DB::table('system_logs')
            ->select(
                DB::raw("CONCAT('sys_', id) as id"),
                'severity',
                'source',
                'message',
                'created_at'
            );

        $auditLogs = DB::table('audit_logs')
            ->select(
                DB::raw("CONCAT('audit_', id) as id"),
                DB::raw("'info' as severity"),
                DB::raw("COALESCE(entity_type, 'audit') as source"),
                DB::raw("COALESCE(description, action) as message"),
                'created_at'
            );

        $paginator = $systemLogs->union($auditLogs)
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        $paginator->getCollection()->transform(function ($item) {
            if (!empty($item->created_at)) {
                $item->created_at = \Carbon\Carbon::parse($item->created_at)->toIso8601String();
            }
            return $item;
        });

        return response()->json($paginator);
    }

    public function integrationLogs(Request $request)
    {
        $integrationSources = ['discord', 'slack', 'whatsapp', 'sms', 'email', 'call', 'webhook', 'integration'];

        $logs = SystemLog::whereIn('source', $integrationSources)
            ->orWhere('log_type', SystemLog::LOG_TYPE_INTEGRATION)
            ->orderBy('created_at', 'desc')
            ->paginate(50, [
                'id',
                'source',
                'integration_key',
                'log_type',
                'event_type',
                'execution_status',
                'message',
                'payload',
                'error_message',
                'created_at'
            ]);

        return response()->json($logs);
    }
    public function advancedLogs(Request $request)
    {
        $category = $request->input('category', 'all');

        if ($category === 'all') {
            return $this->index($request); // Fallback to the master union query for 'all'
        }

        $query = SystemLog::query();

        switch ($category) {
            case 'notifications':
                $query->whereIn('source', ['discord', 'slack', 'whatsapp', 'sms', 'email', 'call']);
                break;
            case 'integrations':
                $query->where(function ($q) {
                    $q->where('log_type', 'integration')
                      ->orWhere('source', 'webhook');
                });
                break;
            case 'up':
                $query->where(function ($q) {
                    $q->whereRaw("JSON_EXTRACT(payload, '$.action') = 'up'")
                      ->orWhere('message', 'like', '%up%')
                      ->orWhere('message', 'like', '%resolved%')
                      ->orWhere('message', 'like', '%start%');
                });
                break;
            case 'down':
                $query->where(function ($q) {
                    $q->whereRaw("JSON_EXTRACT(payload, '$.action') = 'down'")
                      ->orWhere('message', 'like', '%down%')
                      ->orWhere('message', 'like', '%degraded%')
                      ->orWhere('message', 'like', '%offline%');
                });
                break;
            case 'cronjobs':
                $query->whereIn('source', ['cron', 'scheduler', 'task_scheduling']);
                break;
            case 'workers':
                $query->whereIn('source', ['queue', 'worker', 'horizon']);
                break;
            case 'errors':
                $query->whereIn('severity', ['error', 'critical']);
                break;
        }

        $logs = $query->orderBy('created_at', 'desc')->paginate(50, [
            'id',
            'severity',
            'source',
            'integration_key',
            'log_type',
            'event_type',
            'execution_status',
            'message',
            'payload',
            'error_message',
            'created_at'
        ]);

        return response()->json($logs);
    }
}
