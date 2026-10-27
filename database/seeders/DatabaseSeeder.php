<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ControlRoom;
use App\Models\TestingRoom;
use App\Models\PlcDevice;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Control Rooms ──────────────────────────────────────────────────────
        $cr1 = ControlRoom::create(['name' => 'Control Room 1', 'code' => 'CR1', 'description' => 'Cell 1 - Cell 2 - Cell 3']);
        $cr2 = ControlRoom::create(['name' => 'Control Room 2', 'code' => 'CR2', 'description' => 'Cell 4 - Cell 5 - Pit 1 - Pit 2']);
        $cr3 = ControlRoom::create(['name' => 'Control Room 3', 'code' => 'CR3', 'description' => 'Pit 3 - Pit 4 - Pit 5 - Pit 6']);

        // ── Testing Rooms ──────────────────────────────────────────────────────
        // Create pits first so testing_room_id 1–6 = Test Pit 1–6 (192.168.1.1–.6),
        // then cells 7–11 = Test Cell 1–5 (192.168.1.11–.15) — matches python-modbus/config.py PLC_DEVICES.
        $testingRooms = [
            ['control_room_id' => $cr2->id, 'name' => 'Test Pit 1', 'code' => 'TP1', 'type' => 'pit', 'plc_ip' => '192.168.1.1'],
            ['control_room_id' => $cr2->id, 'name' => 'Test Pit 2', 'code' => 'TP2', 'type' => 'pit', 'plc_ip' => '192.168.1.2'],
            ['control_room_id' => $cr3->id, 'name' => 'Test Pit 3', 'code' => 'TP3', 'type' => 'pit', 'plc_ip' => '192.168.1.3'],
            ['control_room_id' => $cr3->id, 'name' => 'Test Pit 4', 'code' => 'TP4', 'type' => 'pit', 'plc_ip' => '192.168.1.4'],
            ['control_room_id' => $cr3->id, 'name' => 'Test Pit 5', 'code' => 'TP5', 'type' => 'pit', 'plc_ip' => '192.168.1.5'],
            ['control_room_id' => $cr3->id, 'name' => 'Test Pit 6', 'code' => 'TP6', 'type' => 'pit', 'plc_ip' => '192.168.1.6'],
            ['control_room_id' => $cr1->id, 'name' => 'Test Cell 1', 'code' => 'TC1', 'type' => 'cell', 'plc_ip' => '192.168.1.11'],
            ['control_room_id' => $cr1->id, 'name' => 'Test Cell 2', 'code' => 'TC2', 'type' => 'cell', 'plc_ip' => '192.168.1.12'],
            ['control_room_id' => $cr1->id, 'name' => 'Test Cell 3', 'code' => 'TC3', 'type' => 'cell', 'plc_ip' => '192.168.1.13'],
            ['control_room_id' => $cr2->id, 'name' => 'Test Cell 4', 'code' => 'TC4', 'type' => 'cell', 'plc_ip' => '192.168.1.14'],
            ['control_room_id' => $cr2->id, 'name' => 'Test Cell 5', 'code' => 'TC5', 'type' => 'cell', 'plc_ip' => '192.168.1.15'],
        ];

        foreach ($testingRooms as $testingRoomData) {
            $plcIp = $testingRoomData['plc_ip'];
            unset($testingRoomData['plc_ip']);
            $testingRoom = TestingRoom::create($testingRoomData);

            PlcDevice::create([
                'testing_room_id' => $testingRoom->id,
                'name' => "PLC {$testingRoomData['name']}",
                'ip_address' => $plcIp,
                'port' => 502,
                'unit_id' => 1,
                'is_enabled' => true,
                'status' => 'offline',
            ]);
        }

        $this->command->info('✓ Seed selesai! (single-user, tanpa login — semua menu terbuka)');
    }
}
