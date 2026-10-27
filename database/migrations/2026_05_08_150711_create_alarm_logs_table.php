<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('alarm_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plc_device_id')->nullable()->constrained()->onDelete('no action');
            $table->foreignId('testing_room_id')->nullable()->constrained()->onDelete('no action');
            $table->foreignId('control_room_id')->nullable()->constrained()->onDelete('no action');

            $table->string('alarm_code');              // "LEFT_MOTOR_FAIL"
            $table->string('alarm_description');       // "Left Motor Failure"
            $table->enum('severity', ['info', 'warning', 'critical'])->default('warning');
            $table->enum('status', ['active', 'acknowledged', 'resolved'])->default('active');

            $table->timestamp('triggered_at');
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('resolved_at')->nullable();

            $table->timestamps();
            $table->index(['testing_room_id', 'status']);
            $table->index(['control_room_id', 'triggered_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('alarm_logs');
    }
};
