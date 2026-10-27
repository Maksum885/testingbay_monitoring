<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AlarmController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\PlcController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

/*
| Single-user, tanpa login. Semua endpoint terbuka.
| Endpoint bridge (webhook / bridge-devices) tetap
| dilindungi token statis (PLC_BRIDGE_TOKEN / PLC_WEBHOOK_SECRET).
*/

Route::get('/dashboard', DashboardController::class);

Route::get('/rooms', [RoomController::class, 'index']);
Route::get('/rooms/{room_id}', [RoomController::class, 'show']);

Route::get('/plc/all/data', [PlcController::class, 'getAllRoomsData']);
Route::get('/plc/{room_id}/data', [PlcController::class, 'getRoomData']);
Route::get('/plc/{room_id}/logs', [PlcController::class, 'getRoomLogs']);

Route::get('/alarms', [AlarmController::class, 'index']);
Route::get('/alarms/count', [AlarmController::class, 'count']);
Route::patch('/alarms/{id}/ack', [AlarmController::class, 'acknowledge']);
Route::patch('/alarms/{id}/resolve', [AlarmController::class, 'resolve']);

Route::get('/activity-logs', [ActivityLogController::class, 'index']);
Route::get('/activity-logs/room/{room_id}', [ActivityLogController::class, 'byRoom']);
Route::get('/activity-logs/maintenance/{room_id}', [ActivityLogController::class, 'maintenanceLogs']);

// ── Bridge Python (token statis, bukan sesi user) ─────────────────────────────
Route::post('/plc/webhook', [PlcController::class, 'webhook'])
    ->middleware('throttle:120,1');

Route::get('/plc/bridge-devices', [PlcController::class, 'bridgeDevices'])
    ->middleware('throttle:60,1');
