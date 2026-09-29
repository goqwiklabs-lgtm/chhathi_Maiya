<?php
// InfinityFree PHP + MySQL Public Chat Backend
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database Credentials provided for InfinityFree (Encrypted)
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
$db_host = sec_decrypt('10190453445e47365c565b580a1c1107060d0c71515f5f');
$db_port = '3306';
$db_name = sec_decrypt('0a0e583e4750586f050806043c0b0009151c01366d5d535f1a093711010a0536516f515e021c');
$db_user = sec_decrypt('0a0e583e4750586f05080604');
$db_pass = sec_decrypt('120910302d3c01275965');

try {
    $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}

// Function to safely create the chat_messages table
function ensure_chat_table_exists($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `chat_messages` (
                `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(100) NOT NULL,
                `message` TEXT NOT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        return true;
    } catch (Exception $e) {
        // Fallback for older MySQL versions that might not support utf8mb4_unicode_ci
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `chat_messages` (
                    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    `name` VARCHAR(100) NOT NULL,
                    `message` TEXT NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
            ");
            return true;
        } catch (Exception $e2) {
            return false;
        }
    }
}

// Auto-create table
ensure_chat_table_exists($pdo);

$action = isset($_GET['action']) ? $_GET['action'] : 'get_messages';

// Diagnostic Test Action: open https://domain/api/chat.php?action=test
if ($action === 'test') {
    $table_exists = false;
    $count = 0;
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'chat_messages'")->fetchAll();
        $table_exists = count($check) > 0;
        if ($table_exists) {
            $cnt = $pdo->query("SELECT COUNT(*) as cnt FROM `chat_messages`")->fetch();
            $count = (int)$cnt['cnt'];
        }
    } catch (Exception $e) {
        $table_exists = false;
    }

    echo json_encode([
        'success' => true,
        'status' => 'MySQL Connected & Ready',
        'database' => $db_name,
        'host' => $db_host,
        'user' => $db_user,
        'table_exists' => $table_exists,
        'message_count' => $count,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

if ($action === 'get_messages') {
    $after_id = isset($_GET['after_id']) ? (int)$_GET['after_id'] : 0;
    $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 60;

    try {
        if ($after_id > 0) {
            $stmt = $pdo->prepare("SELECT id, name, message, DATE_FORMAT(created_at, '%h:%i %p') as time_formatted, UNIX_TIMESTAMP(created_at) as timestamp FROM chat_messages WHERE id > :after_id ORDER BY id ASC LIMIT :limit");
            $stmt->bindValue(':after_id', $after_id, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $messages = $stmt->fetchAll();
        } else {
            // Fetch latest messages
            $stmt = $pdo->prepare("SELECT id, name, message, DATE_FORMAT(created_at, '%h:%i %p') as time_formatted, UNIX_TIMESTAMP(created_at) as timestamp FROM (SELECT * FROM chat_messages ORDER BY id DESC LIMIT :limit) sub ORDER BY id ASC");
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $messages = $stmt->fetchAll();
        }

        echo json_encode([
            'success' => true,
            'messages' => $messages
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage(), 'messages' => []]);
    }
    exit;
}

if ($action === 'send_message' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw_input = file_get_contents('php://input');
    $input_data = json_decode($raw_input, true);

    $name = '';
    $message = '';

    if (is_array($input_data)) {
        $name = isset($input_data['name']) ? trim($input_data['name']) : '';
        $message = isset($input_data['message']) ? trim($input_data['message']) : '';
    } else {
        $name = isset($_POST['name']) ? trim($_POST['name']) : '';
        $message = isset($_POST['message']) ? trim($_POST['message']) : '';
    }

    $name = mb_substr($name, 0, 40, 'UTF-8');
    if (empty($name)) {
        $name = 'श्रद्धालु (Devotee)';
    }

    $message = mb_substr($message, 0, 400, 'UTF-8');
    if (empty($message)) {
        echo json_encode(['success' => false, 'error' => 'Message cannot be empty']);
        exit;
    }

    $name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

    try {
        $stmt = $pdo->prepare("INSERT INTO `chat_messages` (`name`, `message`) VALUES (:name, :message)");
        $stmt->execute([
            ':name' => $name,
            ':message' => $message
        ]);

        $new_id = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => [
                'id' => (int)$new_id,
                'name' => $name,
                'message' => $message,
                'time_formatted' => date('h:i A'),
                'timestamp' => time()
            ]
        ]);
    } catch (Exception $e) {
        // Attempt auto-recovery if table was missing
        if (strpos($e->getMessage(), "doesn't exist") !== false || strpos($e->getMessage(), "42S02") !== false) {
            ensure_chat_table_exists($pdo);
            try {
                $stmt = $pdo->prepare("INSERT INTO `chat_messages` (`name`, `message`) VALUES (:name, :message)");
                $stmt->execute([
                    ':name' => $name,
                    ':message' => $message
                ]);
                $new_id = $pdo->lastInsertId();
                echo json_encode([
                    'success' => true,
                    'message' => [
                        'id' => (int)$new_id,
                        'name' => $name,
                        'message' => $message,
                        'time_formatted' => date('h:i A'),
                        'timestamp' => time()
                    ]
                ]);
                exit;
            } catch (Exception $e2) {
                echo json_encode(['success' => false, 'error' => $e2->getMessage()]);
                exit;
            }
        }
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
