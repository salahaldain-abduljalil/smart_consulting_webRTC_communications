<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ConsultationRequest extends Model
{
    /** @use HasFactory<\Database\Factories\ConsultationRequestFactory> */
    use HasFactory;

    protected $fillable = [
        'client_id',
        'purpose',
        'questionnaire',
        'category',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'questionnaire' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function session(): HasOne
    {
        return $this->hasOne(ConsultationSession::class, 'consultation_request_id');
    }
}
