<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use App\Models\Workspace as Company;
use App\Models\Workspace;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;

class RegisteredUserController extends Controller
{
    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request)
    {
        try {
            $request->validate([
                'name' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z\s]+$/'],
                'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:' . User::class],
                'password' => ['required', 'confirmed', Rules\Password::defaults()],
                'company_name' => ['required', 'string', 'max:255'],
            ], [
                'email.unique' => 'Email is already registered. Please try another email ID',
            ]);

            $company = Workspace::create([
                'name' => $request->company_name,
                'slug' => Str::slug($request->company_name),
                'primary_contact_email' => $request->email,
            ]);

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
            ]);

            // Send discord signup alert
            try {
                app(\App\Services\DiscordAlertService::class)->notifySignup($user, 'email', $company->name);
            } catch (\Throwable $e) {
                Log::error('Discord signup notify failed: ' . $e->getMessage());
            }

            $user->workspaces()->syncWithoutDetaching([
                $company->id => ['role' => User::ROLE_OWNER],
            ]);

            $user->activateWorkspace($company->id);

            event(new Registered($user));
            $token = $user->createToken('api_token')->plainTextToken;

            Auth::login($user);

            return response()->json([
                'message' => 'Registration successful',
                'token'   => $token,
                'user'    => $user,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => $e->validator->errors()->first('email') ?: 'Validation failed'
            ], 422);
        } catch (\Throwable $e) {
            Log::error('RegisteredUserController store failed: ' . $e->getMessage());
            return response()->json(['message' => 'Registration failed'], 500);
        }
    }
}
