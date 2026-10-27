<?php

namespace App\Services;

use App\Models\AlarmLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class AlarmService
{
    /**
     * Single-user, tanpa login: tidak ada scoping per user.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $q = AlarmLog::query()->with(['testingRoom', 'controlRoom'])->orderByDesc('triggered_at');

        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['test_cell_id'])) {
            $q->where('testing_room_id', $filters['test_cell_id']);
        }
        if (! empty($filters['severity'])) {
            $q->where('severity', $filters['severity']);
        }

        return $q->paginate($perPage);
    }

    public function countActive(): int
    {
        return AlarmLog::query()->where('status', 'active')->count();
    }
}
