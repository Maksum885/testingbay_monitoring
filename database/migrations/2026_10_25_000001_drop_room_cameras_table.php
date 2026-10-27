<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fitur kamera / CV dihapus — buang tabel room_cameras dari database lama.
     */
    public function up(): void
    {
        Schema::dropIfExists('room_cameras');
    }

    public function down(): void
    {
        //
    }
};
