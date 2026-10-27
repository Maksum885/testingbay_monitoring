<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\PlcRoomUpdated;
use App\Models\AlarmLog;
use App\Models\PlcDevice;
use App\Models\PlcRegisterLog;
use App\Models\PlcSnapshot;
use App\Models\TestingRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PlcController extends Controller
{
    // ─── bridgeDevices ────────────────────────────────────────────────────────

    /**
     * GET /api/plc/bridge-devices?token=...
     * Kirim daftar enabled PLC devices ke python-modbus (device_loader.py).
     */
    public function bridgeDevices(Request $request): JsonResponse
    {
        $expected = (string) env('PLC_BRIDGE_TOKEN', '');
        if ($expected === '' || ! hash_equals($expected, (string) $request->query('token', ''))) {
            return response()->json(['ok' => false, 'reason' => 'Forbidden'], 403);
        }

        $rows = PlcDevice::query()
            ->with('testingRoom:id,name')
            ->where('is_enabled', true)
            ->orderBy('testing_room_id')
            ->get();

        $devices = [];
        foreach ($rows as $d) {
            $devices[(string) $d->testing_room_id] = [
                'ip'      => $d->ip_address,
                'port'    => (int) $d->port,
                'unit_id' => (int) $d->unit_id,
                'name'    => $d->testingRoom?->name ?? $d->name,
            ];
        }

        return response()->json(['ok' => true, 'devices' => $devices]);
    }

    // ─── webhook ──────────────────────────────────────────────────────────────

    /**
     * POST /api/plc/webhook
     * Menerima polling result dari python-modbus.
     */
    public function webhook(Request $request): JsonResponse
    {
        // 1. Secret verification
        $configuredSecret = (string) env('PLC_WEBHOOK_SECRET', '');
        if ($configuredSecret !== '') {
            $incoming = (string) $request->header('X-PLC-Secret', '');
            if (! hash_equals($configuredSecret, $incoming)) {
                return response()->json(['ok' => false, 'reason' => 'Unauthorized'], 401);
            }
        }

        // 2. Validation
        $validator = Validator::make($request->all(), [
            'room_id'   => ['required', 'integer', 'min:1'],
            'status'    => ['required', 'string', 'in:success,timeout,error,offline'],
            'polled_at' => ['required', 'date'],
            'snapshot'  => ['nullable', 'array'],
            'changes'   => ['nullable', 'array'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'ok'     => false,
                'reason' => 'Invalid payload',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data     = $validator->validated();
        $roomId   = (int) $data['room_id'];
        $status   = (string) $data['status'];
        $time     = (string) $data['polled_at'];
        $snapshot = $data['snapshot'] ?? [];
        $changes  = $data['changes']  ?? [];

        // 3. Find models
        $testingRoom = TestingRoom::find($roomId);
        $plcDevice   = PlcDevice::where('testing_room_id', $roomId)->first();

        if (! $testingRoom || ! $plcDevice) {
            Log::warning("PlcController::webhook — room_id={$roomId} not found");
            return response()->json(['ok' => false, 'reason' => 'Room not found'], 404);
        }

        // 4. Update PLC device status
        $deviceStatus = match ($status) {
            'success' => 'online',
            'error'   => 'error',
            default   => 'offline',   // offline, timeout
        };
        $plcDevice->update([
            'status'       => $deviceStatus,
            'last_seen_at' => now(),
        ]);

        // 5. Cache snapshot (untuk GET /api/plc/{room_id}/data)
        Cache::put("plc_snapshot_{$roomId}", [
            'data'      => $snapshot,
            'status'    => $status,
            'polled_at' => $time,
            'room_id'   => $roomId,
            'room_name' => $testingRoom->name,
        ], now()->addSeconds(30));

        // 6. Broadcast ke frontend via Pusher/Echo
        try {
            broadcast(new PlcRoomUpdated($roomId, $snapshot, $status, $time));
        } catch (\Throwable $e) {
            Log::warning('PlcRoomUpdated broadcast failed: ' . $e->getMessage());
        }

        // 7. Simpan snapshot ke database (background)
        $pollStatusDb = match ($status) {
            'success' => 'success',
            'error'   => 'error',
            default   => 'timeout',
        };

        PlcSnapshot::create([
            'plc_device_id'   => $plcDevice->id,
            'testing_room_id' => $roomId,
            'register_values' => $snapshot,
            'poll_status'     => $pollStatusDb,
            'error_message'   => $data['error'] ?? null,
            'polled_at'       => $time,
        ]);

        // 8. Proses register changes
        foreach ($changes as $change) {
            try {
                $this->saveRegisterChange($plcDevice, $testingRoom, $change, $time);
            } catch (\Throwable $e) {
                Log::error("saveRegisterChange failed: {$e->getMessage()}", $change);
            }
        }

        return response()->json([
            'ok'               => true,
            'changes_processed'=> count($changes),
            'device_status'    => $deviceStatus,
        ]);
    }

    // ─── saveRegisterChange ───────────────────────────────────────────────────

    private function saveRegisterChange(
        PlcDevice   $device,
        TestingRoom $room,
        array       $change,
        string      $time
    ): void {
        $address = (int) $change['register_address'];
        $newVal  = $change['new_value'];
        $oldVal  = $change['old_value'] ?? null;

        // Resolve change_type berdasarkan address + nilai
        $changeType = $this->resolveChangeType($address, $newVal);

        // Encode decoded_value
        $decodedValue = match (true) {
            is_bool($newVal) => $newVal ? 'true' : 'false',
            is_float($newVal) => number_format($newVal, 3),
            default => (string) $newVal,
        };

        // Encode untuk DB (integer column)
        $newValDb = is_bool($newVal) ? (int) $newVal : (int) $newVal;
        $oldValDb = $oldVal !== null ? (is_bool($oldVal) ? (int) $oldVal : (int) $oldVal) : null;

        PlcRegisterLog::create([
            'plc_device_id'        => $device->id,
            'testing_room_id'      => $room->id,
            'control_room_id'      => $room->control_room_id,
            'register_address'     => $address,
            'register_name'        => $change['register_name']  ?? "REG_{$address}",
            'register_description' => $change['register_desc']
                                   ?? $change['register_description']
                                   ?? $change['register_name']
                                   ?? "Register {$address}",
            'old_value'            => $oldValDb,
            'new_value'            => $newValDb,
            'decoded_value'        => $decodedValue,
            'change_type'          => $changeType,
            'occurred_at'          => $time,
        ]);

        // ── Alarm log khusus register 40002 (ALARM ALERT / EMERGENCY) ────────
        if ($address === 40002) {
            if ($newVal) {
                // Alarm baru aktif
                AlarmLog::create([
                    'plc_device_id'    => $device->id,
                    'testing_room_id'  => $room->id,
                    'control_room_id'  => $room->control_room_id,
                    'alarm_code'       => 'ALARM_ALERT',
                    'alarm_description'=> "Alarm Alert / Emergency — {$room->name}",
                    'severity'         => 'critical',
                    'status'           => 'active',
                    'triggered_at'     => $time,
                ]);
            } else {
                // Alarm cleared → resolve semua alarm aktif room ini
                AlarmLog::where('testing_room_id', $room->id)
                    ->where('status', 'active')
                    ->update([
                        'status'      => 'resolved',
                        'resolved_at' => $time,
                    ]);
            }
        }
    }

    private function resolveChangeType(int $address, mixed $newVal): string
    {
        return match ($address) {
            40002  => $newVal ? 'alarm_triggered'      : 'alarm_cleared',
            40003  => $newVal ? 'maintenance_on'       : 'maintenance_off',
            40006  => 'roof_moving',
            40007  => 'roof_moving',
            40008  => 'door_locked',
            40009  => $newVal ? 'testing_started'      : 'testing_stopped',
            default => is_bool($newVal) ? 'status_change' : 'value_change',
        };
    }

    // ─── getRoomData ──────────────────────────────────────────────────────────

    /**
     * GET /api/plc/{room_id}/data
     * Realtime snapshot dari cache (diisi oleh webhook).
     */
    public function getRoomData(int $room_id): JsonResponse
    {
        $cached = Cache::get("plc_snapshot_{$room_id}");
        return response()->json($cached ?? [
            'status'  => 'no_data',
            'room_id' => $room_id,
            'message' => 'Belum ada data dari PLC. Pastikan python-modbus berjalan.',
        ]);
    }

    // ─── getRoomLogs ──────────────────────────────────────────────────────────

    /**
     * GET /api/plc/{room_id}/logs
     */
    public function getRoomLogs(Request $request, int $room_id): JsonResponse
    {
        $query = PlcRegisterLog::where('testing_room_id', $room_id)
            ->orderByDesc('occurred_at');

        if ($request->filled('register_address')) {
            $query->where('register_address', (int) $request->register_address);
        }
        if ($request->filled('change_type')) {
            $query->where('change_type', $request->change_type);
        }
        if ($request->filled('from')) {
            $query->where('occurred_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('occurred_at', '<=', $request->to);
        }

        return response()->json($query->paginate(50));
    }

    // ─── getAllRoomsData ───────────────────────────────────────────────────────

    /**
     * GET /api/plc/all/data (admin only)
     */
    public function getAllRoomsData(): JsonResponse
    {
        $rooms = TestingRoom::where('is_active', true)->pluck('id');
        $out   = [];
        foreach ($rooms as $id) {
            $out[$id] = Cache::get("plc_snapshot_{$id}") ?? ['status' => 'no_data'];
        }
        return response()->json(['rooms' => $out]);
    }
}