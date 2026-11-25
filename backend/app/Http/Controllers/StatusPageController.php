<?php

namespace App\Http\Controllers;

use App\Models\StatusPage;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StatusPageController extends Controller
{
    public function index(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $workspace = Workspace::find($user->workspace_id);

        $statusPages = $workspace->statusPages()
            ->withCount('domains')
            ->latest()
            ->get();

        return response()->json([
            'statusPages' => $statusPages,
            'canAdd' => $workspace->canAddStatusPage(),
        ]);
    }

    public function store(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $workspace = Workspace::find($user->workspace_id);

        if (!$workspace->canAddStatusPage()) {
            return response()->json([
                'message' => 'You have reached the maximum number of status pages for your plan.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:status_pages,slug',
            'is_published' => 'boolean',
            'domains' => 'array',
            'domains.*' => 'integer|exists:domains,id',
        ]);

        $statusPage = $workspace->statusPages()->create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['slug']),
            'is_published' => $validated['is_published'] ?? true,
        ]);

        if (!empty($validated['domains'])) {
            $statusPage->domains()->sync($validated['domains']);
        }

        return response()->json([
            'message' => 'Status page created successfully.',
            'statusPage' => $statusPage->load('domains'),
        ]);
    }

    public function show(Request $request, $ulid)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $workspace = Workspace::find($user->workspace_id);

        $statusPage = $workspace->statusPages()
            ->where('ulid', $ulid)
            ->with('domains')
            ->firstOrFail();

        return response()->json($statusPage);
    }

    public function update(Request $request, $ulid)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $workspace = Workspace::find($user->workspace_id);

        $statusPage = $workspace->statusPages()
            ->where('ulid', $ulid)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:status_pages,slug,' . $statusPage->id,
            'is_published' => 'boolean',
            'domains' => 'array',
            'domains.*' => 'integer|exists:domains,id',
        ]);

        $statusPage->update([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['slug']),
            'is_published' => $validated['is_published'] ?? true,
        ]);

        if (isset($validated['domains'])) {
            // Verify domains belong to workspace
            $validDomains = $workspace->domains()
                ->whereIn('id', $validated['domains'])
                ->pluck('id');
                
            $statusPage->domains()->sync($validDomains);
        }

        return response()->json([
            'message' => 'Status page updated successfully.',
            'statusPage' => $statusPage->load('domains'),
        ]);
    }

    public function destroy(Request $request, $ulid)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $workspace = Workspace::find($user->workspace_id);

        $statusPage = $workspace->statusPages()
            ->where('ulid', $ulid)
            ->firstOrFail();

        $statusPage->delete();

        return response()->json([
            'message' => 'Status page deleted successfully.',
        ]);
    }
}
