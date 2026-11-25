<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DomainAiAnalysisResource extends JsonResource
{
    /**
     * @return array<string,mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'domain_id' => $this->domain_id,
            'performance' => $this->scoreValue('performance'),
            'seo' => $this->scoreValue('seo'),
            'ux' => $this->scoreValue('ux'),
            'performanceSuggestions' => $this->suggestionList('performance'),
            'seoSuggestions' => $this->suggestionList('seo'),
            'uxSuggestions' => $this->suggestionList('ux'),
            'securitySuggestions' => $this->suggestionList('security'),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }

    protected function scoreValue(string $key): ?int
    {
        $value = data_get($this->scores ?? [], $key);
        if ($value === null) {
            return null;
        }

        $int = (int) $value;
        return max(0, min(100, $int));
    }

    /**
     * @return array<int,string>
     */
    protected function suggestionList(string $key): array
    {
        $items = data_get($this->suggestions ?? [], $key, []);

        if (! is_array($items)) {
            return [];
        }

        $cleaned = array_filter(array_map(function ($item) {
            return is_string($item) ? trim($item) : null;
        }, $items));

        return array_values($cleaned);
    }
}
