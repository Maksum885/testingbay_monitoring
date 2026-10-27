<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PlcDataService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        protected PlcDataService $plcDataService
    ) {}

    /**
     * GET /api/dashboard — bentuk sama dengan normalizeDashboardPayload di frontend.
     */
    public function __invoke(Request $request)
    {
        $payload = $this->plcDataService->buildDashboardPayload();

        return response()->json($payload);
    }
}
