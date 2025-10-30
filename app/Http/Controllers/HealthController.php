<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class HealthController extends Controller
{
    protected function checkPortOpen(string $host, int $port, float $timeout = 1.0): bool
    {
        $errno = 0;
        $errstr = '';
        $start = microtime(true);
        $fp = @fsockopen($host, $port, $errno, $errstr, (int) ceil($timeout));
        if ($fp) {
            fclose($fp);
            return true;
        }
        return false;
    }

    public function index(Request $request)
    {
        try {
            $sfuSecretSet = (bool) env('SFU_SECRET');
            $turnSecretSet = (bool) env('TURN_SECRET');

            $sfuHost = env('MEDIASOUP_ANNOUNCED_IP', '127.0.0.1');
            $sfuPort = intval(env('SFU_PORT', env('PORT', 4000)));
            $sfuPortOpen = $this->checkPortOpen($sfuHost, $sfuPort, 1);

            $turnHost = env('TURN_HOST', request()->getHost());
            $turnPort = intval(env('TURN_PORT', 3478));
            $turnPortOpen = $this->checkPortOpen($turnHost, $turnPort, 1);

            $ok = $sfuSecretSet && $turnSecretSet;

            return response()->json([
                'ok' => $ok,
                'php_version' => phpversion(),
                'app_url' => env('APP_URL'),
                'checks' => [
                    'sfu' => [
                        'secret_set' => $sfuSecretSet,
                        'host' => $sfuHost,
                        'port' => $sfuPort,
                        'port_open' => $sfuPortOpen,
                    ],
                    'turn' => [
                        'secret_set' => $turnSecretSet,
                        'host' => $turnHost,
                        'port' => $turnPort,
                        'port_open' => $turnPortOpen,
                    ],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('health check error', ['exception' => $e]);
            return response()->json(['ok' => false, 'error' => 'health check failed'], 500);
        }
    }
}
