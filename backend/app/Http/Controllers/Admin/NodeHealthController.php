<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\PlatformStatusService;
use Illuminate\Http\JsonResponse;

class NodeHealthController extends Controller
{
    public function __construct(private PlatformStatusService $statusService) {}

    /**
     * GET /api/admin/node-health
     * Returns live node health status for the admin panel.
     */
    public function index(): JsonResponse
    {
        $nodes = $this->statusService->getNodeStatuses();
        return response()->json(['data' => $nodes]);
    }
}
