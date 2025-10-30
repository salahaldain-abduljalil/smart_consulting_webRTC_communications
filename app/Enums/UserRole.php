<?php

namespace App\Enums;

enum UserRole: string
{
    case Client = 'client';
    case Supervisor = 'supervisor';
    case Advisor = 'advisor';

    public function isClient(): bool
    {
        return $this === self::Client;
    }

    public function isSupervisor(): bool
    {
        return $this === self::Supervisor;
    }

    public function isAdvisor(): bool
    {
        return $this === self::Advisor;
    }
}
