<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlarmLog extends Model
{
    protected $fillable = [
        'plc_device_id',
        'testing_room_id',
        'control_room_id',
        'alarm_code',
        'alarm_description',
        'severity',
        'status',
        'triggered_at',
        'acknowledged_at',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'triggered_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function plcDevice(): BelongsTo
    {
        return $this->belongsTo(PlcDevice::class);
    }

    public function testingRoom(): BelongsTo
    {
        return $this->belongsTo(TestingRoom::class);
    }

    public function controlRoom(): BelongsTo
    {
        return $this->belongsTo(ControlRoom::class);
    }
}
