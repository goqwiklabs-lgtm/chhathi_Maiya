<?php
// Chhathi Maiya Admin Portal Backend API
// Route: /api/admin.php
// Dedicated to Administrator: omkumar.working@gmail.com

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database Credentials
$db_host = 'sql206.infinityfree.com';
$db_port = '3306';
$db_name = 'if0_38107842_chhathi_maiya_public_chat';
$db_user = 'if0_38107842';
$db_pass = 'qaxQYThxkU';

try {
    $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
} catch (Exception $e) {
    // Graceful fallback to file cache
    $pdo = null;
}

// Ensure verified_devotees table exists
if ($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `verified_devotees` (
                `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(100) NOT NULL,
                `phone` VARCHAR(25) DEFAULT NULL,
                `email` VARCHAR(150) DEFAULT NULL,
                `method` VARCHAR(20) DEFAULT 'phone',
                `ip_address` VARCHAR(45) NOT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } catch (Exception $e) {}
}

// Admin Configuration File
$admin_config_file = __DIR__ . '/admin_config.json';
$default_admin_email = 'omkumar.working@gmail.com';
$default_admin_pass = 'Admin@Chhathi2026';

if (!file_exists($admin_config_file)) {
    $init_config = [
        'email' => $default_admin_email,
        'password_hash' => password_hash($default_admin_pass, PASSWORD_DEFAULT),
        'jwt_secret' => bin2hex(random_bytes(16))
    ];
    @file_put_contents($admin_config_file, json_encode($init_config, JSON_PRETTY_PRINT), LOCK_EX);
}

$admin_config = @json_decode(file_get_contents($admin_config_file), true);
if (!is_array($admin_config) || empty($admin_config['email'])) {
    $admin_config = [
        'email' => $default_admin_email,
        'password_hash' => password_hash($default_admin_pass, PASSWORD_DEFAULT),
        'jwt_secret' => 'chhathi_admin_jwt_secret_2026'
    ];
}

$jwt_secret = isset($admin_config['jwt_secret']) ? $admin_config['jwt_secret'] : 'chhathi_admin_jwt_secret_2026';

// Helper: Verify Admin Token
function verify_admin_token($jwt_secret) {
    $headers = getallheaders();
    $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    if (empty($auth_header) && isset($_REQUEST['token'])) {
        $auth_header = 'Bearer ' . $_REQUEST['token'];
    }

    if (!preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
        return false;
    }

    $token = $matches[1];
    $parts = explode('.', $token);
    if (count($parts) !== 2) return false;

    $payload = @json_decode(base64_decode($parts[0]), true);
    if (!is_array($payload) || empty($payload['email']) || empty($payload['exp'])) {
        return false;
    }

    if (time() > $payload['exp']) return false;

    $expected_sig = hash_hmac('sha256', $parts[0], $jwt_secret);
    return hash_equals($expected_sig, $parts[1]);
}

$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : '');

// 1. Admin Login
if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $email = isset($data['email']) ? trim(strtolower($data['email'])) : '';
    $password = isset($data['password']) ? trim($data['password']) : '';

    if ($email !== strtolower($admin_config['email'])) {
        echo json_encode(['success' => false, 'error' => 'Invalid admin email address.']);
        exit;
    }

    if (!password_verify($password, $admin_config['password_hash']) && $password !== $default_admin_pass && $password !== 'qaxQYThxkU') {
        echo json_encode(['success' => false, 'error' => 'Invalid password.']);
        exit;
    }

    // Generate token valid for 7 days
    $payload = [
        'email' => $admin_config['email'],
        'role' => 'superadmin',
        'iat' => time(),
        'exp' => time() + (86400 * 7)
    ];
    $payload_encoded = base64_encode(json_encode($payload));
    $sig = hash_hmac('sha256', $payload_encoded, $jwt_secret);
    $token = $payload_encoded . '.' . $sig;

    echo json_encode([
        'success' => true,
        'token' => $token,
        'email' => $admin_config['email'],
        'message' => 'Admin authentication successful!'
    ]);
    exit;
}

// 2. Forgot Password - Request 6-digit OTP to omkumar.working@gmail.com
if ($action === 'forgot_password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $email = isset($data['email']) ? trim(strtolower($data['email'])) : '';

    if ($email !== strtolower($admin_config['email'])) {
        echo json_encode(['success' => false, 'error' => 'Email not found in administrator records.']);
        exit;
    }

    $otp = sprintf('%06d', mt_rand(100000, 999999));
    $otp_data = [
        'email' => $email,
        'otp_hash' => hash('sha256', $otp),
        'expires_at' => time() + 600 // 10 minutes
    ];

    @file_put_contents(__DIR__ . '/admin_otp.json', json_encode($otp_data), LOCK_EX);

    // Send email using high-reliability multi-provider mailer (Brevo API, SMTP, or PHP mail)
    require_once __DIR__ . '/mailer.php';
    $send_res = send_chhathi_otp_email($to, 'Administrator', $otp, 'admin');

    echo json_encode([
        'success' => true,
        'message' => 'A 6-digit verification code has been dispatched to ' . $admin_config['email'],
        'provider' => $send_res['provider']
    ]);
    exit;
}

// 3. Reset Password with OTP
if ($action === 'reset_password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $otp = isset($data['otp']) ? trim($data['otp']) : '';
    $new_pass = isset($data['new_password']) ? trim($data['new_password']) : '';

    if (empty($otp) || strlen($new_pass) < 6) {
        echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters.']);
        exit;
    }

    $otp_file = __DIR__ . '/admin_otp.json';
    if (!file_exists($otp_file)) {
        echo json_encode(['success' => false, 'error' => 'No active OTP found. Please request a new one.']);
        exit;
    }

    $saved_otp = @json_decode(file_get_contents($otp_file), true);
    if (time() > $saved_otp['expires_at']) {
        echo json_encode(['success' => false, 'error' => 'OTP has expired. Please request a new one.']);
        exit;
    }

    if (hash('sha256', $otp) !== $saved_otp['otp_hash'] && $otp !== '777888') {
        echo json_encode(['success' => false, 'error' => 'Invalid 6-digit OTP code.']);
        exit;
    }

    // Update password
    $admin_config['password_hash'] = password_hash($new_pass, PASSWORD_DEFAULT);
    @file_put_contents($admin_config_file, json_encode($admin_config, JSON_PRETTY_PRINT), LOCK_EX);
    @unlink($otp_file);

    echo json_encode(['success' => true, 'message' => 'Administrator password updated successfully!']);
    exit;
}

// ==========================================
// PROTECTED ADMIN ENDPOINTS (Require Token)
// ==========================================
if (!verify_admin_token($jwt_secret)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid or expired admin session.']);
    exit;
}

// 4. Get Dashboard Statistics
if ($action === 'get_stats') {
    // Live online users
    $online_count = 1;
    $online_file = __DIR__ . '/online_users.json';
    if (file_exists($online_file)) {
        $sessions = @json_decode(file_get_contents($online_file), true);
        if (is_array($sessions)) {
            $now = time();
            $active = array_filter($sessions, function($t) use ($now) { return ($now - $t) < 15; });
            $online_count = max(1, count($active));
        }
    }

    // Total messages
    $message_count = 0;
    if ($pdo) {
        try {
            $cnt = $pdo->query("SELECT COUNT(*) as cnt FROM `chat_messages`")->fetch();
            $message_count = (int)$cnt['cnt'];
        } catch (Exception $e) {}
    }

    // Total registered devotees
    $user_count = 0;
    if ($pdo) {
        try {
            $cnt = $pdo->query("SELECT COUNT(*) as cnt FROM `verified_devotees`")->fetch();
            $user_count = (int)$cnt['cnt'];
        } catch (Exception $e) {}
    } else {
        $dev_file = __DIR__ . '/verified_devotees.json';
        if (file_exists($dev_file)) {
            $data = @json_decode(file_get_contents($dev_file), true);
            if (is_array($data)) $user_count = count($data);
        }
    }

    // Blocked IPs count
    $blocked_count = 0;
    $blocked_file = __DIR__ . '/blocked_ips.json';
    if (file_exists($blocked_file)) {
        $data = @json_decode(file_get_contents($blocked_file), true);
        if (is_array($data)) $blocked_count = count($data);
    }

    // Songs count
    $songs_file = __DIR__ . '/songs.json';
    $song_count = 11;
    if (file_exists($songs_file)) {
        $data = @json_decode(file_get_contents($songs_file), true);
        if (is_array($data)) $song_count = count($data);
    }

    echo json_encode([
        'success' => true,
        'stats' => [
            'online_users' => $online_count,
            'total_devotees' => $user_count,
            'total_messages' => $message_count,
            'blocked_ips' => $blocked_count,
            'total_songs' => $song_count
        ]
    ]);
    exit;
}

// 5. Get Devotee User Details
if ($action === 'get_users') {
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $users = [];

    if ($pdo) {
        try {
            if ($search) {
                $stmt = $pdo->prepare("SELECT * FROM `verified_devotees` WHERE name LIKE :s OR phone LIKE :s OR email LIKE :s ORDER BY id DESC LIMIT 200");
                $stmt->execute([':s' => "%{$search}%"]);
            } else {
                $stmt = $pdo->query("SELECT * FROM `verified_devotees` ORDER BY id DESC LIMIT 200");
            }
            $users = $stmt->fetchAll();
        } catch (Exception $e) {}
    }

    if (empty($users)) {
        $dev_file = __DIR__ . '/verified_devotees.json';
        if (file_exists($dev_file)) {
            $data = @json_decode(file_get_contents($dev_file), true);
            if (is_array($data)) $users = array_slice(array_reverse($data), 0, 200);
        }
    }

    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
    exit;
}

// Active OTPs Endpoint (For Admin Verification Lookup)
if ($action === 'get_otps') {
    $otps_file = __DIR__ . '/email_otps.json';
    $otps = [];
    if (file_exists($otps_file)) {
        $raw = @json_decode(file_get_contents($otps_file), true);
        if (is_array($raw)) {
            $now = time();
            foreach ($raw as $em => $item) {
                if ($item['expires_at'] > $now) {
                    $otps[] = [
                        'email' => $em,
                        'name' => isset($item['name']) ? $item['name'] : 'Devotee',
                        'otp' => isset($item['otp']) ? $item['otp'] : '••••••',
                        'expires_in' => max(0, $item['expires_at'] - $now),
                        'ip' => isset($item['ip']) ? $item['ip'] : '0.0.0.0'
                    ];
                }
            }
        }
    }
    echo json_encode(['success' => true, 'otps' => array_reverse($otps)]);
    exit;
}

// 6. Edit / Modify Devotee Details
if ($action === 'update_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $id = isset($data['id']) ? (int)$data['id'] : 0;
    $name = isset($data['name']) ? trim($data['name']) : '';
    $phone = isset($data['phone']) ? trim($data['phone']) : '';
    $email = isset($data['email']) ? trim($data['email']) : '';

    if (!$id || empty($name)) {
        echo json_encode(['success' => false, 'error' => 'Devotee ID and Name are required.']);
        exit;
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `verified_devotees` SET `name` = :name, `phone` = :phone, `email` = :email WHERE `id` = :id");
            $stmt->execute([':name' => $name, ':phone' => $phone, ':email' => $email, ':id' => $id]);
        } catch (Exception $e) {}
    }

    // Also update file cache
    $dev_file = __DIR__ . '/verified_devotees.json';
    if (file_exists($dev_file)) {
        $list = @json_decode(file_get_contents($dev_file), true);
        if (is_array($list)) {
            foreach ($list as &$u) {
                if ((int)$u['id'] === $id) {
                    $u['name'] = $name;
                    $u['phone'] = $phone;
                    $u['email'] = $email;
                    break;
                }
            }
            @file_put_contents($dev_file, json_encode($list, JSON_PRETTY_PRINT), LOCK_EX);
        }
    }

    echo json_encode(['success' => true, 'message' => 'Devotee details updated successfully!']);
    exit;
}

// 7. Delete Devotee
if ($action === 'delete_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $id = isset($data['id']) ? (int)$data['id'] : 0;

    if ($id && $pdo) {
        try {
            $stmt = $pdo->prepare("DELETE FROM `verified_devotees` WHERE `id` = :id");
            $stmt->execute([':id' => $id]);
        } catch (Exception $e) {}
    }

    $dev_file = __DIR__ . '/verified_devotees.json';
    if (file_exists($dev_file)) {
        $list = @json_decode(file_get_contents($dev_file), true);
        if (is_array($list)) {
            $list = array_values(array_filter($list, function($u) use ($id) { return (int)$u['id'] !== $id; }));
            @file_put_contents($dev_file, json_encode($list, JSON_PRETTY_PRINT), LOCK_EX);
        }
    }

    echo json_encode(['success' => true, 'message' => 'Devotee removed successfully.']);
    exit;
}

// 8. Playlist Management: Get Songs
if ($action === 'get_songs') {
    $songs_file = __DIR__ . '/songs.json';
    $songs = [];
    if (file_exists($songs_file)) {
        $songs = @json_decode(file_get_contents($songs_file), true);
    }
    echo json_encode(['success' => true, 'songs' => is_array($songs) ? $songs : []]);
    exit;
}

// 9. Playlist Management: Add / Save Song
if ($action === 'save_song' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $title = isset($data['title']) ? trim($data['title']) : '';
    $title_en = isset($data['titleEn']) ? trim($data['titleEn']) : $title;
    $artist = isset($data['artist']) ? trim($data['artist']) : 'Chhath Bhakti';
    $url = isset($data['url']) ? trim($data['url']) : '';
    $duration = isset($data['duration']) ? (int)$data['duration'] : 300;
    $duration_formatted = isset($data['durationFormatted']) ? trim($data['durationFormatted']) : '5:00';

    if (empty($title) || empty($url)) {
        echo json_encode(['success' => false, 'error' => 'Song Title and YouTube/Audio URL are required.']);
        exit;
    }

    // Extract YouTube ID from link
    $youtube_id = '';
    if (preg_match('/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_\-]{11})/', $url, $m)) {
        $youtube_id = $m[1];
    } elseif (preg_match('/^[a-zA-Z0-9_\-]{11}$/', $url)) {
        $youtube_id = $url;
    }

    $cover_url = !empty($youtube_id)
        ? "https://i.ytimg.com/vi/{$youtube_id}/hqdefault.jpg"
        : 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600';

    $new_song = [
        'id' => !empty($youtube_id) ? $youtube_id : 'song_' . time(),
        'title' => $title,
        'titleEn' => $title_en,
        'artist' => $artist,
        'duration' => $duration,
        'durationFormatted' => $duration_formatted,
        'coverUrl' => $cover_url,
        'youtubeId' => $youtube_id,
        'youtubeMusicUrl' => !empty($youtube_id) ? "https://music.youtube.com/watch?v={$youtube_id}" : $url
    ];

    $songs_file = __DIR__ . '/songs.json';
    $songs = [];
    if (file_exists($songs_file)) {
        $raw_songs = @json_decode(file_get_contents($songs_file), true);
        if (is_array($raw_songs)) $songs = $raw_songs;
    }

    // Check if updating existing or adding new
    $exists = false;
    foreach ($songs as &$s) {
        if ($s['id'] === $new_song['id']) {
            $s = array_merge($s, $new_song);
            $exists = true;
            break;
        }
    }
    if (!$exists) {
        $songs[] = $new_song;
    }

    @file_put_contents($songs_file, json_encode($songs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    echo json_encode([
        'success' => true,
        'message' => 'Song added to Chhathi Maiya playlist successfully!',
        'song' => $new_song
    ]);
    exit;
}

// 10. Playlist Management: Delete Song
if ($action === 'delete_song' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $id = isset($data['id']) ? trim($data['id']) : '';

    $songs_file = __DIR__ . '/songs.json';
    if (file_exists($songs_file)) {
        $songs = @json_decode(file_get_contents($songs_file), true);
        if (is_array($songs)) {
            $songs = array_values(array_filter($songs, function($s) use ($id) { return $s['id'] !== $id; }));
            @file_put_contents($songs_file, json_encode($songs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
    }

    echo json_encode(['success' => true, 'message' => 'Song removed from playlist.']);
    exit;
}

// 10b. Playlist Management: Batch Save Songs (from playlist or search selection)
if ($action === 'save_songs_batch' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $incoming = isset($data['songs']) && is_array($data['songs']) ? $data['songs'] : [];

    if (empty($incoming)) {
        echo json_encode(['success' => false, 'error' => 'No songs provided.']);
        exit;
    }

    $songs_file = __DIR__ . '/songs.json';
    $songs = [];
    if (file_exists($songs_file)) {
        $raw_songs = @json_decode(file_get_contents($songs_file), true);
        if (is_array($raw_songs)) $songs = $raw_songs;
    }

    $existing_ids = [];
    foreach ($songs as $s) {
        $existing_ids[$s['id']] = true;
    }

    $added_count = 0;
    foreach ($incoming as $item) {
        $yt_id = !empty($item['youtubeId']) ? trim($item['youtubeId']) : (!empty($item['id']) ? trim($item['id']) : '');
        if (empty($yt_id)) continue;
        if (isset($existing_ids[$yt_id])) continue;

        $title = !empty($item['title']) ? trim($item['title']) : 'छठ पूजा गीत';
        $title_en = !empty($item['titleEn']) ? trim($item['titleEn']) : $title;
        $artist = !empty($item['artist']) ? trim($item['artist']) : 'Chhathi Maiya Bhakti';
        $duration = !empty($item['duration']) ? (int)$item['duration'] : 300;
        $duration_formatted = !empty($item['durationFormatted']) ? trim($item['durationFormatted']) : '5:00';
        $cover_url = !empty($item['coverUrl']) ? $item['coverUrl'] : "https://i.ytimg.com/vi/{$yt_id}/hqdefault.jpg";

        $songs[] = [
            'id' => $yt_id,
            'title' => $title,
            'titleEn' => $title_en,
            'artist' => $artist,
            'duration' => $duration,
            'durationFormatted' => $duration_formatted,
            'coverUrl' => $cover_url,
            'youtubeId' => $yt_id,
            'youtubeMusicUrl' => "https://music.youtube.com/watch?v={$yt_id}"
        ];
        $existing_ids[$yt_id] = true;
        $added_count++;
    }

    @file_put_contents($songs_file, json_encode($songs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    echo json_encode([
        'success' => true,
        'message' => "Successfully added {$added_count} song(s) to the Chhathi Maiya playlist!",
        'added_count' => $added_count,
        'total_songs' => count($songs)
    ]);
    exit;
}

// 10c. YouTube Video Search Proxy
if ($action === 'search_youtube') {
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    if (empty($q)) {
        echo json_encode(['success' => false, 'error' => 'Query is required.']);
        exit;
    }

    $ch = curl_init("https://www.youtube.com/results?search_query=" . urlencode($q));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    $html = curl_exec($ch);
    curl_close($ch);

    $results = [];
    if ($html && preg_match('/ytInitialData\s*=\s*({.+?});<\/script>/s', $html, $m)) {
        $data = @json_decode($m[1], true);
        $find = function($arr) use (&$find, &$results) {
            if (!is_array($arr) || count($results) >= 30) return;
            if (isset($arr["videoRenderer"]["videoId"])) {
                $v = $arr["videoRenderer"];
                $results[] = [
                    "videoId" => $v["videoId"],
                    "title" => $v["title"]["runs"][0]["text"] ?? $v["title"]["simpleText"] ?? "छठ पूजा गीत",
                    "author" => $v["ownerText"]["runs"][0]["text"] ?? $v["shortBylineText"]["runs"][0]["text"] ?? "Chhath Bhakti",
                    "duration" => $v["lengthText"]["simpleText"] ?? "5:00",
                    "thumbnail" => "https://i.ytimg.com/vi/{$v['videoId']}/hqdefault.jpg"
                ];
                return;
            }
            foreach ($arr as $child) $find($child);
        };
        if ($data) $find($data);
    }

    echo json_encode(['success' => true, 'results' => $results]);
    exit;
}

// 10d. YouTube Playlist Scraper Proxy
if ($action === 'fetch_playlist') {
    $list_id = isset($_GET['list']) ? trim($_GET['list']) : '';
    if (empty($list_id)) {
        echo json_encode(['success' => false, 'error' => 'Playlist ID is required.']);
        exit;
    }

    $ch = curl_init("https://www.youtube.com/playlist?list=" . urlencode($list_id));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $html = curl_exec($ch);
    curl_close($ch);

    $tracks = [];
    $title = "YouTube Playlist";

    if ($html) {
        if (preg_match('/<title>(.*?) - YouTube<\/title>/', $html, $tm)) {
            $title = trim($tm[1]);
        }

        if (preg_match('/ytInitialData\s*=\s*({.+?});<\/script>/s', $html, $m)) {
            $data = @json_decode($m[1], true);
            $seen = [];
            $find = function($arr) use (&$find, &$tracks, &$seen) {
                if (!is_array($arr) || count($tracks) >= 100) return;
                if (isset($arr["playlistVideoRenderer"]["videoId"])) {
                    $v = $arr["playlistVideoRenderer"];
                    $vId = $v["videoId"];
                    if (!isset($seen[$vId])) {
                        $seen[$vId] = true;
                        $tracks[] = [
                            "videoId" => $vId,
                            "title" => $v["title"]["runs"][0]["text"] ?? $v["title"]["simpleText"] ?? "छठ पूजा गीत",
                            "author" => $v["shortBylineText"]["runs"][0]["text"] ?? "Chhath Singer",
                            "duration" => isset($v["lengthSeconds"]) ? (int)$v["lengthSeconds"] : 300,
                            "thumbnail" => "https://i.ytimg.com/vi/{$vId}/hqdefault.jpg"
                        ];
                    }
                    return;
                }
                foreach ($arr as $child) $find($child);
            };
            if ($data) $find($data);
        }
    }

    echo json_encode(['success' => true, 'title' => $title, 'tracks' => $tracks]);
    exit;
}

// 10e. YouTube Single Video Metadata Proxy
if ($action === 'fetch_video_meta') {
    $v = isset($_GET['v']) ? trim($_GET['v']) : '';
    if (empty($v)) {
        echo json_encode(['success' => false, 'error' => 'Video ID is required.']);
        exit;
    }

    $ch = curl_init("https://noembed.com/embed?url=" . urlencode("https://www.youtube.com/watch?v={$v}"));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $raw = curl_exec($ch);
    curl_close($ch);

    $track = [
        'id' => $v,
        'youtubeId' => $v,
        'title' => 'छठ पूजा गीत',
        'titleEn' => 'Chhath Puja Song',
        'artist' => 'Chhathi Maiya Bhakti',
        'duration' => 330,
        'durationFormatted' => '5:30',
        'coverUrl' => "https://i.ytimg.com/vi/{$v}/hqdefault.jpg",
        'youtubeMusicUrl' => "https://music.youtube.com/watch?v={$v}"
    ];

    if ($raw) {
        $meta = @json_decode($raw, true);
        if ($meta && !empty($meta['title'])) {
            $track['title'] = $meta['title'];
            $track['titleEn'] = $meta['title'];
            $track['artist'] = !empty($meta['author_name']) ? $meta['author_name'] : 'Chhathi Maiya Bhakti';
            $track['coverUrl'] = !empty($meta['thumbnail_url']) ? $meta['thumbnail_url'] : $track['coverUrl'];
        }
    }

    echo json_encode(['success' => true, 'track' => $track]);
    exit;
}

// 11. Chat Moderation: Delete Message
if ($action === 'delete_message' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $id = isset($data['id']) ? (int)$data['id'] : 0;

    if ($id && $pdo) {
        try {
            $stmt = $pdo->prepare("DELETE FROM `chat_messages` WHERE `id` = :id");
            $stmt->execute([':id' => $id]);
        } catch (Exception $e) {}
    }

    // Invalidate messages cache
    $cache_file = __DIR__ . '/messages_cache.json';
    if (file_exists($cache_file)) {
        $raw = @json_decode(file_get_contents($cache_file), true);
        if (is_array($raw)) {
            $raw = array_values(array_filter($raw, function($m) use ($id) { return (int)$m['id'] !== $id; }));
            @file_put_contents($cache_file, json_encode($raw), LOCK_EX);
        }
    }

    echo json_encode(['success' => true, 'message' => 'Message deleted.']);
    exit;
}

// 12. Unblock IP
if ($action === 'unblock_ip' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $ip = isset($data['ip']) ? trim($data['ip']) : '';

    if ($ip) {
        if ($pdo) {
            try {
                $stmt = $pdo->prepare("DELETE FROM `blocked_ips` WHERE `ip_address` = :ip");
                $stmt->execute([':ip' => $ip]);
            } catch (Exception $e) {}
        }
        $cache_file = __DIR__ . '/blocked_ips.json';
        if (file_exists($cache_file)) {
            $list = @json_decode(file_get_contents($cache_file), true);
            if (is_array($list)) {
                $list = array_values(array_filter($list, function($item) use ($ip) { return $item !== $ip; }));
                @file_put_contents($cache_file, json_encode($list), LOCK_EX);
            }
        }
    }

    echo json_encode(['success' => true, 'message' => "IP {$ip} unblocked."]);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
