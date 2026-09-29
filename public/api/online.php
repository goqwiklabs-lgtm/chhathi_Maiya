<?php
// Simple, robust real-time online presence tracker for PHP hosting (e.g. InfinityFree)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$cache_file = __DIR__ . '/online_users.json';
$timeout_seconds = 10; // Client considered active if heartbeated in last 10 seconds
$now = time();

// Read existing sessions
$sessions = [];
if (file_exists($cache_file)) {
    $raw = @file_get_contents($cache_file);
    if ($raw) {
        $decoded = @json_decode($raw, true);
        if (is_array($decoded)) {
            $sessions = $decoded;
        }
    }
}

// Get client ID from query param
$client_id = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['id']) : '';
$action = isset($_GET['action']) ? $_GET['action'] : 'heartbeat';

// Filter out expired sessions (> 10s inactive)
$active_sessions = [];
foreach ($sessions as $id => $timestamp) {
    if (($now - $timestamp) < $timeout_seconds) {
        $active_sessions[$id] = $timestamp;
    }
}

if ($action === 'leave' && $client_id) {
    unset($active_sessions[$client_id]);
} elseif ($client_id) {
    $active_sessions[$client_id] = $now;
}

// Save active sessions safely with file locking
@file_put_contents($cache_file, json_encode($active_sessions), LOCK_EX);

// Global online count across all devices & browsers
$count = max(1, count($active_sessions));

echo json_encode([
    'online' => $count,
    'timestamp' => $now
]);
