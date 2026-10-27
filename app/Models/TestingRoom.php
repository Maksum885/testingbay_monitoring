<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestingRoom extends Model
{
    protected $fillable = [
        'control_room_id',
        'name',
        'code',
        'type',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function controlRoom(): BelongsTo
    {
        return $this->belongsTo(ControlRoom::class);
    }

    public function plcDevices(): HasMany
    {
        return $this->hasMany(PlcDevice::class);
    }

    public function alarmLogs(): HasMany
    {
        return $this->hasMany(AlarmLog::class);
    }

    public function plcSnapshots(): HasMany
    {
        return $this->hasMany(PlcSnapshot::class);
    }
}
