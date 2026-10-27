<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlarmLog;
use App\Models\PlcRegisterLog;
use App\Models\TestingRoom;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class RoomController extends Controller
{
    /**
     * Daftar testing room sesuai hak akses user.
     */
    public function index(Request $request)
    {
        $q = TestingRoom::query()->with('controlRoom')->where('is_active', true)->orderBy('code');

        return response()->json($q->get());
    }

    /**
     * Detail satu room: meta + snapshot cache + log ringkas + alarm aktif.
     */
    public function show(Request $request, int $room_id)
    {
        $room = TestingRoom::with('controlRoom')->findOrFail($room_id);

        $snapshot = Cache::get('plc_snapshot_'.$room_id);

        $recentLogs = PlcRegisterLog::query()
            ->where('testing_room_id', $room_id)
            ->orderByDesc('occurred_at')
            ->limit(20)
            ->get();

        $activeAlarms = AlarmLog::query()
            ->where('testing_room_id', $room_id)
            ->where('status', 'active')
            ->orderByDesc('triggered_at')
            ->get();

        return response()->json([
            'room' => $room,
            'plc_snapshot' => $snapshot,
            'recent_logs' => $recentLogs,
            'active_alarms' => $activeAlarms,
        ]);
    }
}
