<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string $roles): Response
    {
        $user = $request->user();
        if (!$user) {
            abort(401);
        }

        $allowed = collect(explode(',', $roles))
            ->map(fn ($r) => trim($r))
            ->filter()
            ->map(function (string $role) {
                return match ($role) {
                    'client' => UserRole::Client,
                    'supervisor' => UserRole::Supervisor,
                    'advisor' => UserRole::Advisor,
                    default => $role,
                };
            })
            ->all();

        if (! in_array($user->role, $allowed, true)) {
            abort(403);
        }

        return $next($request);
    }
}



