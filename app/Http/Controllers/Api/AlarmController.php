<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlarmLog;
use App\Services\AlarmService;
use Illuminate\Http\Request;

class AlarmController extends Controller
{
    public function __construct(
        protected AlarmService $alarmService
    ) {}

    public function index(Request $request)
    {
        $filters = $request->only(['status', 'test_cell_id', 'severity']);

        return response()->json(
            $this->alarmService->paginate($filters, 25)
        );
    }

    public function count(Request $request)
    {
        return response()->json([
            'count' => $this->alarmService->countActive(),
        ]);
    }

    public function acknowledge(Request $request, int $id)
    {
        $alarm = AlarmLog::findOrFail($id);

        if ($alarm->status !== 'active') {
            return response()->json(['message' => 'Alarm tidak aktif.'], 422);
        }

        $alarm->update([
            'status' => 'acknowledged',
            'acknowledged_at' => now(),
        ]);

        return response()->json(['message' => 'Alarm di-acknowledge.', 'alarm' => $alarm->fresh()]);
    }

    public function resolve(Request $request, int $id)
    {
        $alarm = AlarmLog::findOrFail($id);

        $alarm->update([
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        return response()->json(['message' => 'Alarm diselesaikan.', 'alarm' => $alarm->fresh()]);
    }
}
