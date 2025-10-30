<?php

namespace App\Policies;

use App\Models\ConsultationRequest;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use App\Enums\UserRole;

class ConsultationPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [UserRole::Supervisor, UserRole::Advisor, UserRole::Client], true);
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ConsultationRequest $consultationRequest): bool
    {
        if ($user->role === UserRole::Supervisor) {
            return true;
        }

        if ($user->role === UserRole::Client) {
            return $consultationRequest->client_id === $user->id;
        }

        if ($user->role === UserRole::Advisor) {
            return $consultationRequest->session?->advisor_id === $user->id;
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->role === UserRole::Client;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ConsultationRequest $consultationRequest): bool
    {
        return $user->role === UserRole::Supervisor;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ConsultationRequest $consultationRequest): bool
    {
        return $user->role === UserRole::Supervisor;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, ConsultationRequest $consultationRequest): bool
    {
        return $user->role === UserRole::Supervisor;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, ConsultationRequest $consultationRequest): bool
    {
        return $user->role === UserRole::Supervisor;
    }
}
