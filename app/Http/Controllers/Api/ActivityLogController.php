<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlcRegisterLog;
use App\Models\TestingRoom;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function __construct(
        protected ActivityLogService $activityLogService
    ) {}

    public function index(Request $request)
    {
        $filters = array_filter($request->only([
            'test_cell_id',
            'register_address',
            'change_type',
            'from',
            'to',
            'page',
        ]), fn ($v) => $v !== null && $v !== '');

        $query = PlcRegisterLog::query()->with(['plcDevice', 'testingRoom.controlRoom'])
            ->orderByDesc('occurred_at');

        if (! empty($filters['test_cell_id'])) {
            $query->where('testing_room_id', $filters['test_cell_id']);
        }
        if (! empty($filters['register_address'])) {
            $query->where('register_address', $filters['register_address']);
        }
        if (! empty($filters['change_type'])) {
            $query->where('change_type', $filters['change_type']);
        }
        if (! empty($filters['from'])) {
            $query->where('occurred_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->where('occurred_at', '<=', $filters['to']);
        }

        return response()->json($query->paginate(50));
    }

    public function byRoom(Request $request, int $room_id)
    {
        TestingRoom::findOrFail($room_id);

        $filters = array_filter($request->only(['register_address', 'change_type', 'from']), fn ($v) => $v !== null && $v !== '');

        return response()->json(
            $this->activityLogService->getLogsForRoom($room_id, $filters, 50)
        );
    }

    public function maintenanceLogs(Request $request, int $room_id)
    {
        TestingRoom::findOrFail($room_id);

        $logs = PlcRegisterLog::query()
            ->where('testing_room_id', $room_id)
            ->whereIn('change_type', ['maintenance_on', 'maintenance_off'])
            ->orderByDesc('occurred_at')
            ->paginate(50);

        return response()->json($logs);
    }
}
