<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Halaman utama dashboard — single-user, tanpa login.
     */
    public function index(Request $request)
    {
        return view('shared.dashboard');
    }
}
