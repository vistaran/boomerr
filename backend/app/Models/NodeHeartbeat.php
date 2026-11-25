<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NodeHeartbeat extends Model
{
    protected $fillable = [
        'node_id',
        'aws_region',
        'status',
        'latency_ms',
        'checks_run_24h',
        'success_rate_24h',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'latency_ms'       => 'integer',
        'checks_run_24h'   => 'integer',
        'success_rate_24h' => 'float',
        'created_at'       => 'datetime',
        'updated_at'       => 'datetime',
    ];

    /**
     * Get the latest heartbeat record for each node from real incoming telemetry.
     */
    public static function latestPerNode(): \Illuminate\Support\Collection
    {
        $latestIds = static::selectRaw('MAX(id) as id')
            ->groupBy('node_id')
            ->pluck('id');

        return static::whereIn('id', $latestIds)->get()->keyBy('node_id');
    }

    /**
     * Record a heartbeat from real incoming Lambda telemetry.
     */
    public static function recordFromTelemetry(
        string $region,
        ?int $latencyMs = null,
        ?int $checksRun24h = null,
        ?float $successRate24h = null
    ): self {
        $nodeId = str_starts_with($region, 'node-') ? $region : 'node-' . $region;
        $awsRegion = str_replace('node-', '', $region);

        return static::create([
            'node_id'          => $nodeId,
            'aws_region'       => $awsRegion,
            'status'           => 'healthy',
            'latency_ms'       => $latencyMs,
            'checks_run_24h'   => $checksRun24h,
            'success_rate_24h' => $successRate24h,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);
    }
}
