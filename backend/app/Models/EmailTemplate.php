<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Log;

class EmailTemplate extends Model
{
    use HasFactory;

    protected $table = 'email_templates';

    protected $fillable = [
        'key',
        'name',
        'category',
        'sequence_name',
        'step_order',
        'delay_value',
        'delay_unit',
        'trigger_event',
        'trigger_condition',
        'subject',
        'body_html',
        'body_plain',
        'variables',
        'description',
        'is_active',
    ];

    protected $casts = [
        'variables' => 'array',
        'is_active' => 'boolean',
        'step_order' => 'integer',
        'delay_value' => 'integer',
    ];

    /**
     * Scope a query to filter by sequence.
     */
    public function scopeSequence($query, ?string $sequence)
    {
        if ($sequence) {
            return $query->where('sequence_name', $sequence);
        }
        return $query;
    }

    /**
     * Calculate delay in total hours for comparison in automated workflows.
     */
    public function getDelayInHours(): int
    {
        if (!$this->delay_value) {
            return 0;
        }

        return match ($this->delay_unit) {
            'hours' => $this->delay_value,
            'days' => $this->delay_value * 24,
            'weeks' => $this->delay_value * 24 * 7,
            'months' => $this->delay_value * 24 * 30,
            default => $this->delay_value,
        };
    }

    /**
     * Scope a query to only include active templates.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to filter by category.
     */
    public function scopeCategory($query, ?string $category)
    {
        if ($category) {
            return $query->where('category', $category);
        }
        return $query;
    }

    /**
     * Render the template body using Blade with the given data.
     */
    public function render(array $data = []): string
    {
        try {
            return Blade::render($this->body_html, $data);
        } catch (\Throwable $e) {
            Log::error("Failed to render EmailTemplate [{$this->key}]: " . $e->getMessage(), [
                'template_id' => $this->id,
                'key' => $this->key,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Render the template subject line with the given data.
     */
    public function renderSubject(array $data = []): string
    {
        try {
            return Blade::render($this->subject, $data);
        } catch (\Throwable $e) {
            Log::warning("Failed to render EmailTemplate subject [{$this->key}]: " . $e->getMessage());
            return $this->subject;
        }
    }
}
