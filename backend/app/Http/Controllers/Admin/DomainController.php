<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Domain;

class DomainController extends Controller
{
    public function index(Request $request)
    {
        $domains = Domain::with('company')->orderBy('created_at', 'desc')->paginate(50);
        return response()->json($domains);
    }
}
