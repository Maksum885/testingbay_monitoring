<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ControlRoom extends Model
{
    protected $fillable = ['name', 'code', 'description', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function testingRooms(): HasMany
    {
        return $this->hasMany(TestingRoom::class);
    }
}
