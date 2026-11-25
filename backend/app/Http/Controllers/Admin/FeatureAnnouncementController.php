<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendFeatureAnnouncementEmailJob;
use App\Models\FeatureAnnouncement;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FeatureAnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $query = FeatureAnnouncement::with('creator:id,name,email')->latest();

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('summary', 'like', "%{$search}%")
                  ->orWhere('badge_text', 'like', "%{$search}%");
            });
        }

        $features = $query->paginate($request->input('per_page', 15));

        $stats = [
            'total' => FeatureAnnouncement::count(),
            'coming_soon' => FeatureAnnouncement::where('status', 'coming_soon')->count(),
            'in_beta' => FeatureAnnouncement::where('status', 'in_beta')->count(),
            'live' => FeatureAnnouncement::where('status', 'live')->count(),
            'announced' => FeatureAnnouncement::where('status', 'announced')->count(),
        ];

        return response()->json([
            'features' => $features,
            'stats' => $stats,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:feature_announcements,slug',
            'category' => 'required|string|max:50',
            'status' => 'required|in:coming_soon,in_beta,announced,live',
            'badge_text' => 'nullable|string|max:50',
            'summary' => 'required|string|max:500',
            'description' => 'nullable|string',
            'cta_label' => 'nullable|string|max:100',
            'cta_url' => 'nullable|string|max:255',
            'target_quarter' => 'nullable|string|max:50',
            'release_date' => 'nullable|date',
            'is_pinned' => 'boolean',
            'is_published' => 'boolean',
        ]);

        $admin = $request->user();
        $validated['created_by'] = $admin ? $admin->id : null;

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['title']);
        }

        if (empty($validated['release_date'])) {
            $validated['release_date'] = null;
        }

        $feature = FeatureAnnouncement::create($validated);

        // Send email announcement to all users if requested or published
        if ($request->boolean('send_email', false) || $request->boolean('notify_users', false)) {
            dispatch(new SendFeatureAnnouncementEmailJob($feature));
        }

        return response()->json([
            'message' => 'Feature announcement created successfully.',
            'feature' => $feature->load('creator:id,name,email'),
        ], 201);
    }

    public function show($id)
    {
        $feature = FeatureAnnouncement::with('creator:id,name,email')->findOrFail($id);
        return response()->json($feature);
    }

    public function update(Request $request, $id)
    {
        $feature = FeatureAnnouncement::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:feature_announcements,slug,' . $feature->id,
            'category' => 'required|string|max:50',
            'status' => 'required|in:coming_soon,in_beta,announced,live',
            'badge_text' => 'nullable|string|max:50',
            'summary' => 'required|string|max:500',
            'description' => 'nullable|string',
            'cta_label' => 'nullable|string|max:100',
            'cta_url' => 'nullable|string|max:255',
            'target_quarter' => 'nullable|string|max:50',
            'release_date' => 'nullable|date',
            'is_pinned' => 'boolean',
            'is_published' => 'boolean',
        ]);

        if (empty($validated['release_date'])) {
            $validated['release_date'] = null;
        }

        $feature->update($validated);

        return response()->json([
            'message' => 'Feature announcement updated successfully.',
            'feature' => $feature->fresh('creator:id,name,email'),
        ]);
    }

    public function togglePin($id)
    {
        $feature = FeatureAnnouncement::findOrFail($id);
        $feature->is_pinned = !$feature->is_pinned;
        $feature->save();

        return response()->json([
            'message' => $feature->is_pinned ? 'Feature pinned to top' : 'Feature unpinned',
            'is_pinned' => $feature->is_pinned,
        ]);
    }

    public function destroy($id)
    {
        $feature = FeatureAnnouncement::findOrFail($id);
        $feature->delete();

        return response()->json([
            'message' => 'Feature announcement deleted successfully.',
        ]);
    }

    public function broadcastEmail(Request $request, $id)
    {
        $feature = FeatureAnnouncement::findOrFail($id);
        dispatch(new SendFeatureAnnouncementEmailJob($feature));

        return response()->json([
            'message' => "Announcement email dispatched to all users for '{$feature->title}'.",
        ]);
    }
}

