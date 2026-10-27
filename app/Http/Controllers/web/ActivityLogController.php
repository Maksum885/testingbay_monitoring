<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\PlcRegisterLog;
use App\Models\TestingRoom;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ActivityLogController extends Controller
{
    public function index(Request $request): View
    {
        $query = PlcRegisterLog::query()
            ->with(['plcDevice', 'testingRoom.controlRoom', 'controlRoom'])
            ->orderByDesc('occurred_at');

        if ($request->filled('testing_room_id')) {
            $query->where('testing_room_id', (int) $request->input('testing_room_id'));
        }
        if ($request->filled('change_type')) {
            $query->where('change_type', $request->string('change_type'));
        }

        $logs = $query->paginate(40)->withQueryString();

        $rooms = TestingRoom::query()
            ->where('is_active', true)
            ->with('controlRoom')
            ->orderBy('control_room_id')
            ->orderBy('code')
            ->get();

        $changeTypes = PlcRegisterLog::query()
            ->whereNotNull('change_type')
            ->distinct()
            ->orderBy('change_type')
            ->pluck('change_type');

        return view('admin.activity-logs.index', [
            'logs' => $logs,
            'rooms' => $rooms,
            'changeTypes' => $changeTypes,
        ]);
    }
}
