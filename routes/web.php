<?php

use App\Http\Controllers\Web\ActivityLogController;
use App\Http\Controllers\Web\DashboardController;
use App\Http\Controllers\Web\PlcConnectionController;
use Illuminate\Support\Facades\Route;

/*
| Single-user, tanpa login. Semua route terbuka dan mengakses semua menu.
*/

Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

Route::get('/settings/plc', [PlcConnectionController::class, 'index'])->name('settings.plc');
Route::put('/settings/plc/{plc_device}', [PlcConnectionController::class, 'update'])->name('settings.plc.update');

Route::get('/settings/plc-log', [ActivityLogController::class, 'index'])->name('settings.plc-log');
