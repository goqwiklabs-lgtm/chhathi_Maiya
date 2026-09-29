<?php
// Real-time Online Presence & Active Devotees Tracker for Chhathi Maiya Platform
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!function_exists('sec_decrypt')) {
    function sec_decrypt($hex, $key = 'chhathi_2026') {
        $data = hex2bin($hex);
        $out = '';
        for ($i = 0; $i < strlen($data); $i++) {
            $out .= $data[$i] ^ $key[$i % strlen($key)];
        }
        return $out;
    }
}

// Database Credentials (Encrypted)
$db_host = sec_decrypt('10190453445e47365c565b580a1c1107060d0c71515f5f');
$db_port = '3306';
$db_name = sec_decrypt('0a0e583e4750586f050806043c0b0009151c01366d5d535f1a093711010a0536516f515e021c');
$db_user = sec_decrypt('0a0e583e4750586f05080604');
$db_pass = sec_decrypt('120910302d3c01275965');

$pdo = null;
try {
    $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 4
    ]);
} catch (Exception $e) {
    $pdo = null;
}

if ($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `online_users` (
                `session_id` VARCHAR(100) NOT NULL PRIMARY KEY,
                `ip_address` VARCHAR(45) NOT NULL,
                `devotee_id` INT DEFAULT NULL,
                `devotee_name` VARCHAR(100) DEFAULT NULL,
                `is_admin` TINYINT(1) DEFAULT 0,
                `last_seen` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } catch (Exception $e) {}
}

$client_ip = isset($_SERVER['HTTP_CF_CONNECTING_IP'])
    ? $_SERVER['HTTP_CF_CONNECTING_IP']
    : (isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0] : $_SERVER['REMOTE_ADDR']);
$client_ip = trim($client_ip);

// Session ID from query param or generate deterministic one
$raw_id = isset($_REQUEST['id']) ? trim($_REQUEST['id']) : '';
$client_id = !empty($raw_id) ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $raw_id) : substr(md5($client_ip . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 24);
$action = isset($_REQUEST['action']) ? trim($_REQUEST['action']) : 'heartbeat';
$devotee_name = isset($_REQUEST['name']) ? trim(strip_tags($_REQUEST['name'])) : '';
$is_admin = !empty($_REQUEST['is_admin']) ? 1 : 0;

$now = time();
$timeout_seconds = 90; // Active window: 90 seconds
$cache_file = __DIR__ . '/online_users.json';

// Local file cache load
$sessions = [];
if (file_exists($cache_file)) {
    $raw = @file_get_contents($cache_file);
    if ($raw) {
        $decoded = @json_decode($raw, true);
        if (is_array($decoded)) $sessions = $decoded;
    }
}

// 1. Handle Leave
if ($action === 'leave') {
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("DELETE FROM `online_users` WHERE `session_id` = :id OR `ip_address` = :ip");
            $stmt->execute([':id' => $client_id, ':ip' => $client_ip]);
        } catch (Exception $e) {}
    }
    unset($sessions[$client_id]);
    @file_put_contents($cache_file, json_encode($sessions), LOCK_EX);
    echo json_encode(['success' => true, 'online' => max(1, count($sessions))]);
    exit;
}

// 2. Handle Heartbeat (record in DB)
if ($pdo) {
    try {
        $stmt = $pdo->prepare("REPLACE INTO `online_users` (`session_id`, `ip_address`, `devotee_name`, `is_admin`, `last_seen`) VALUES (:id, :ip, :name, :admin, NOW())");
        $stmt->execute([
            ':id' => $client_id,
            ':ip' => $client_ip,
            ':name' => !empty($devotee_name) ? $devotee_name : null,
            ':admin' => $is_admin
        ]);
        // Clean stale sessions older than 5 minutes
        $pdo->exec("DELETE FROM `online_users` WHERE `last_seen` < DATE_SUB(NOW(), INTERVAL 300 SECOND)");
    } catch (Exception $e) {}
}

// Update file cache
$sessions[$client_id] = $now;
$active_sessions = [];
foreach ($sessions as $id => $timestamp) {
    if (($now - $timestamp) < $timeout_seconds) {
        $active_sessions[$id] = $timestamp;
    }
}
@file_put_contents($cache_file, json_encode($active_sessions), LOCK_EX);

// Count from DB
$db_count = 0;
$active_devotees = [];
if ($pdo) {
    try {
        $stmt = $pdo->query("SELECT COUNT(DISTINCT session_id) as cnt FROM `online_users` WHERE `last_seen` > DATE_SUB(NOW(), INTERVAL 90 SECOND)");
        $row = $stmt->fetch();
        if ($row && isset($row['cnt'])) {
            $db_count = (int)$row['cnt'];
        }

        // Active devotees for @ mention autocomplete
        $dev_stmt = $pdo->query("SELECT DISTINCT devotee_name FROM `online_users` WHERE `devotee_name` IS NOT NULL AND `devotee_name` != '' AND `last_seen` > DATE_SUB(NOW(), INTERVAL 180 SECOND) LIMIT 20");
        $active_devotees = $dev_stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (Exception $e) {}
}

$final_count = max(1, max($db_count, count($active_sessions)));

// Ensure Admin & initial devotee names are included for mentions if list is small
if (empty($active_devotees)) {
    $active_devotees = ['OM KŪmar', 'Ravi Singh', 'Sunita Gupta', 'Chhath Devotee'];
}

echo json_encode([
    'success' => true,
    'online' => $final_count,
    'active_devotees' => array_values(array_unique(array_filter($active_devotees))),
    'mysql_online' => ($pdo !== null),
    'timestamp' => $now
]);
