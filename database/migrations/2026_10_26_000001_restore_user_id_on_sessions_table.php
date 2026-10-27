<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Database yang sudah di-migrate tanpa kolom sessions.user_id:
     * DatabaseSessionHandler Laravel selalu menulis kolom ini (null untuk tamu).
     */
    public function up(): void
    {
        if (! Schema::hasColumn('sessions', 'user_id')) {
            Schema::table('sessions', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        //
    }
};
