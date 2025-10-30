<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdvisorAvailability extends Model
{
    /** @use HasFactory<\Database\Factories\AdvisorAvailabilityFactory> */
    use HasFactory;

    protected $fillable = [
        'advisor_id',
        'starts_at',
        'ends_at',
        'is_blocked',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_blocked' => 'boolean',
        ];
    }

    public function advisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'advisor_id');
    }
}
