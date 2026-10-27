<?php

namespace App\Services;

use App\Models\AlarmLog;
use App\Models\ControlRoom;
use App\Models\TestingRoom;
use Illuminate\Support\Facades\Cache;

class PlcDataService
{
    /**
     * Bentuk payload dashboard sama seperti normalizeDashboardPayload di frontend:
     * { controlRooms: Record<string, object>, utilities: object }
     *
     * Single-user, tanpa login: selalu kembalikan semua control room aktif.
     */
    public function buildDashboardPayload(): array
    {
        $crQuery = ControlRoom::query()->where('is_active', true)->orderBy('code');

        $controlRooms = [];
        foreach ($crQuery->with([
            'testingRooms' => function ($q) {
                $q->where('is_active', true)->orderBy('code')->with(['plcDevices']);
            },
        ])->get() as $cr) {
            $key = $this->controlRoomKey($cr->code);
            $controlRooms[$key] = $this->buildControlRoomShape($cr);
        }

        return [
            'controlRooms' => $controlRooms,
            'utilities' => $this->defaultUtilities(),
        ];
    }

    private function controlRoomKey(string $code): string
    {
        $n = preg_replace('/\D/', '', $code) ?: '1';

        return 'cr'.$n;
    }

    private function buildControlRoomShape(ControlRoom $cr): array
    {
        $linePressure = 0.0;
        $doorLock = 'locked';

        $rooms = [];
        foreach ($cr->testingRooms as $tr) {
            $rooms[] = $this->buildTestingRoomShape($tr, $linePressure, $doorLock);
        }

        return [
            'tp' => 'CONTROL ROOM',
            'nm' => $cr->name,
            'zn' => $cr->description ?? $cr->name,
            'col' => '#1564c0',
            'line_pressure' => round(max(0.0, $linePressure), 2),
            'door_lock' => $doorLock,
            'st' => 'NORMAL',
            'events' => [],
            'rooms' => $rooms,
        ];
    }

    private function buildTestingRoomShape(TestingRoom $tr, &$crLinePressure, &$crDoorLock): array
    {
        $snapshot = Cache::get('plc_snapshot_'.$tr->id);
        $registers = is_array($snapshot) ? ($snapshot['data'] ?? []) : [];

        $device = $tr->plcDevices->first();
        $plcOnline = ($device?->status ?? 'offline') === 'online';
        if (! $plcOnline) {
            $registers = [];
        }

        $uiId = $this->testingRoomUiId($tr);
        $isPit = $tr->type === 'pit';

        /* #40011 / #40012: float32 PSI (tampilan dashboard, tanpa konversi bar). */
        $pressure1 = $this->registerFloat($registers, ['40011', 'pressure_1']);
        if ($pressure1 > 0) {
            $crLinePressure = max($crLinePressure, $pressure1);
        }

        $roof = $this->deriveRoofStateFromRegisters($registers);

        $maintenance = $this->registerBool($registers, ['40003', 'mode_maintenance']);
        $mode = $maintenance ? 'MAINTENANCE' : 'AUTO';

        $doorLocked = $this->registerBool($registers, ['40008', 'pintu_terkunci', 'door_locked']);
        $doorLockStr = $doorLocked ? 'locked' : 'unlocked';
        $crDoorLock = $doorLockStr;

        $testingOn = $this->registerBool($registers, ['40009', 'testing_dimulai']);
        $phase = $testingOn ? 'RUNNING' : 'STANDBY';

        $presIn = $this->registerPressureBar($registers, ['40001', 'tekanan_masuk']);
        $pres2 = $this->registerFloat($registers, ['40012', 'pressure_2']);

        $roofMovingOpen = $this->registerBool($registers, ['40006', 'roof_bergerak_buka']);
        $roofMovingClose = $this->registerBool($registers, ['40007', 'roof_bergerak_tutup']);
        $roofOpenBit = $this->registerBool($registers, ['40005', 'roof_terbuka']);
        $roofClosedBit = $this->registerBool($registers, ['40004', 'roof_tertutup']);

        $alarms = $this->activeAlarmFlags($tr->id);
        $regEmergency = $this->registerBool($registers, ['40002', 'alarm_alert']);

        $events = $this->recentEventsForRoom($tr->id);

        /*
         * Emergency di dashboard = hanya bit hidup #40002 saat PLC online.
         * Jangan OR dengan AlarmLog: entri DB bisa tertinggal aktif setelah putus PLC → sidebar “palsu”.
         */
        $liveEmergency = $plcOnline && $regEmergency;

        $base = [
            'id' => $uiId,
            'api_room_id' => $tr->id,
            'tp' => $isPit ? 'TEST PIT' : 'TEST CELL',
            'nm' => $tr->name,
            'col' => $isPit ? '#c27a00' : '#059652',
            'st' => 'OPERATIONAL',
            'phase' => $phase,
            'roof_state' => $roof,
            'mode' => $mode,
            'door_lock' => $doorLockStr,
            'dual_motor' => true,
            'pres_in' => round($presIn, 2),
            'pres_2' => round($pres2, 2),
            'roof_moving_open' => $roofMovingOpen,
            'roof_moving_close' => $roofMovingClose,
            'reg_roof_open' => $roofOpenBit,
            'reg_roof_closed' => $roofClosedBit,
            'alarm_emergency' => $liveEmergency,
            /* #40001: tekanan masuk sebelum testing (#40009) — alarm bila ada tekanan (> 0) saat testing belum dimulai. */
            'alarm_pressure_in' => $plcOnline && $presIn > 0 && ! $testingOn,
            'alarm_left_motor' => $alarms['left_motor'],
            'alarm_right_motor' => $alarms['right_motor'],
            'alarm_motor' => $alarms['motor'],
            'events' => $events,
        ];

        if ($isPit) {
            $tp = $this->registerFloat($registers, ['test_pressure', '40011']);
            $base += [
                'test_pressure' => $tp,
                'target_pressure' => 100.0,
                'pressure_rate' => 0,
                'max_st' => 'OFF',
                'fluid_type' => 'AIR BERSIH',
            ];
        } else {
            $base += [
                'pres_bbm' => $pressure1 > 0 ? round($pressure1, 2) : 0.0,
            ];
        }

        $base['plc_link_status'] = $device?->status ?? 'offline';
        $base['plc_last_seen_at'] = $device?->last_seen_at?->toIso8601String();

        return $base;
    }

    private function testingRoomUiId(TestingRoom $tr): string
    {
        preg_match('/(\d+)/', $tr->code, $m);
        $n = $m[1] ?? (string) $tr->id;

        return $tr->type === 'pit' ? 'pit'.$n : 'cell'.$n;
    }

    /**
     * @param  array<string, mixed>  $registers
     */
    /**
     * Tekanan masuk (#40001) sering dikirim sebagai uint16 ratusan (510 = 5.1 bar).
     */
    private function registerPressureBar(array $registers, array $keys): float
    {
        $v = $this->registerFloat($registers, $keys);

        return $v > 50 ? $v / 100.0 : $v;
    }

    /**
     * Atap: hanya OPEN atau CLOSE (#40004 / #40005). Bit gerak (#40006/#40007) hanya indikasi arah.
     *
     * @param  array<string, mixed>  $registers
     */
    private function deriveRoofStateFromRegisters(array $registers): string
    {
        if ($this->registerBool($registers, ['40005', 'roof_terbuka'])) {
            return 'OPEN';
        }
        if ($this->registerBool($registers, ['40004', 'roof_tertutup'])) {
            return 'CLOSE';
        }
        if ($this->registerBool($registers, ['40006', 'roof_bergerak_buka'])) {
            return 'OPEN';
        }
        if ($this->registerBool($registers, ['40007', 'roof_bergerak_tutup'])) {
            return 'CLOSE';
        }

        return 'CLOSE';
    }

    private function registerFloat(array $registers, array $keys): float
    {
        foreach ($keys as $k) {
            $cell = $registers[$k] ?? null;
            if (is_array($cell) && isset($cell['value'])) {
                return (float) $cell['value'];
            }
        }

        return 0.0;
    }

    /**
     * @param  array<string, mixed>  $registers
     */
    private function registerBool(array $registers, array $keys): bool
    {
        foreach ($keys as $k) {
            $cell = $registers[$k] ?? null;
            if (is_array($cell) && array_key_exists('value', $cell)) {
                return (bool) $cell['value'];
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $registers
     */
    private function registerString(array $registers, array $keys): string
    {
        foreach ($keys as $k) {
            $cell = $registers[$k] ?? null;
            if (is_array($cell) && isset($cell['value'])) {
                return (string) $cell['value'];
            }
        }

        return '';
    }

    /**
     * @return array{emergency: bool, pressure_in: bool, left_motor: bool, right_motor: bool, motor: bool}
     */
    private function activeAlarmFlags(int $testingRoomId): array
    {
        $codes = AlarmLog::query()
            ->where('testing_room_id', $testingRoomId)
            ->where('status', 'active')
            ->pluck('alarm_code')
            ->map(fn ($c) => strtoupper((string) $c))
            ->all();

        $haystack = implode(' ', $codes);

        return [
            'emergency' => str_contains($haystack, 'EMERGENCY')
                || str_contains($haystack, 'ALARM_ALERT'),
            'pressure_in' => false,
            'left_motor' => str_contains($haystack, 'LEFT'),
            'right_motor' => str_contains($haystack, 'RIGHT'),
            'motor' => str_contains($haystack, 'MOTOR'),
        ];
    }

    private function recentEventsForRoom(int $testingRoomId): array
    {
        $rows = \App\Models\PlcRegisterLog::query()
            ->where('testing_room_id', $testingRoomId)
            ->orderByDesc('occurred_at')
            ->limit(8)
            ->get(['occurred_at', 'change_type', 'register_description']);

        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                't' => $row->occurred_at->format('H:i'),
                'c' => match ($row->change_type) {
                    'alarm_triggered' => 'cr',
                    'alarm_cleared' => 'ok',
                    default => 'in',
                },
                'm' => $row->register_description ?: $row->change_type,
            ];
        }

        return $out;
    }

    /**
     * @return array{pam: mixed, listrik: mixed, hvac: mixed}
     */
    /**
     * Utilitas agregat — nilai nol sampai ada integrasi sensor/energi nyata.
     */
    private function defaultUtilities(): array
    {
        return [
            'pam' => [
                'pump1' => ['nm' => 'Pompa 1', 'st' => 'N/A', 'flow' => 0.0, 'pres' => 0.0, 'amp' => 0.0, 'temp_motor' => 0.0, 'run_hours' => 0],
                'pump2' => ['nm' => 'Pompa 2', 'st' => 'N/A', 'flow' => 0.0, 'pres' => 0.0, 'amp' => 0.0, 'temp_motor' => 0.0, 'run_hours' => 0],
                'tank_level' => 0,
                'total_flow_hari' => 0,
                'last_service' => '—',
            ],
            'listrik' => [
                'total_kw' => 0.0,
                'pf' => 0.0,
                'freq' => 0.0,
                'volt_r' => 0.0,
                'volt_s' => 0.0,
                'volt_t' => 0.0,
                'amp_r' => 0.0,
                'amp_s' => 0.0,
                'amp_t' => 0.0,
                'kwh_hari' => 0.0,
                'st' => '—',
            ],
            'hvac' => [
                'unit1' => ['nm' => 'AC CR1', 'st' => 'N/A', 'set' => 0, 'actual' => 0.0, 'amp' => 0.0],
                'unit2' => ['nm' => 'AC CR2', 'st' => 'N/A', 'set' => 0, 'actual' => 0.0, 'amp' => 0.0],
                'unit3' => ['nm' => 'AC CR3', 'st' => 'N/A', 'set' => 0, 'actual' => 0.0, 'amp' => 0.0],
                'filter_st' => '—',
                'next_service' => '—',
            ],
        ];
    }
}
