<?php

namespace App\Http\Controllers;

use App\Models\NotificationChannel;
use App\Models\SmsNotificationSetting;
use App\Models\WhatsappNotificationSetting;
use Illuminate\Http\Request;

class IntegrationDeliveryController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'type' => 'required|string|in:notification_channel,sms,whatsapp',
            'id' => 'required|string'
        ]);

        $workspaceId = $request->user()->workspace_id;
        $type = $request->type;
        $id = $request->id;

        $model = null;

        if ($type === 'notification_channel') {
            // Integration webhooks (Discord, Slack, Email) use ULID
            $model = NotificationChannel::where('workspace_id', $workspaceId)
                ->where('ulid', $id)
                ->firstOrFail();
        } elseif ($type === 'sms') {
            // SMS config uses ID
            $model = SmsNotificationSetting::where('workspace_id', $workspaceId)
                ->findOrFail($id);
        } elseif ($type === 'whatsapp') {
            // WhatsApp config uses ID
            $model = WhatsappNotificationSetting::where('workspace_id', $workspaceId)
                ->findOrFail($id);
        }

        $deliveries = $model->deliveries()->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($deliveries);
    }
}
