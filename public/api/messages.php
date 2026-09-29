<?php
// InfinityFree PHP + MySQL Public Messages Backend
// Hardened Security: Content Moderation, Real-Name Verification, Anti-Flood Rate Limiting, Automated IP Bans

// Security Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database Credentials for InfinityFree
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
    // Graceful fallback to file cache if MySQL connection is unavailable
    $pdo = null;
}

// Auto-create chat_messages and blocked_ips tables
function ensure_tables_exist($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `chat_messages` (
                `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(100) NOT NULL,
                `message` TEXT NOT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    } catch (Exception $e) {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `chat_messages` (
                    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    `name` VARCHAR(100) NOT NULL,
                    `message` TEXT NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
            ");
        } catch (Exception $e2) {}
    }

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `blocked_ips` (
                `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                `ip_address` VARCHAR(45) NOT NULL UNIQUE,
                `reason` VARCHAR(255) NOT NULL,
                `blocked_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } catch (Exception $e3) {}
}

if ($pdo) {
    ensure_tables_exist($pdo);
}

// Extract real client IP
function get_client_ip() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return trim($_SERVER['HTTP_CF_CONNECTING_IP']);
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    }
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        return trim($_SERVER['HTTP_X_REAL_IP']);
    }
    return isset($_SERVER['REMOTE_ADDR']) ? trim($_SERVER['REMOTE_ADDR']) : '0.0.0.0';
}

$client_ip = get_client_ip();

// Permanently block an IP address (Both disk JSON cache + MySQL)
function block_ip($pdo, $ip, $reason) {
    $cache_file = __DIR__ . '/blocked_ips.json';
    $list = [];
    if (file_exists($cache_file)) {
        $data = @json_decode(file_get_contents($cache_file), true);
        if (is_array($data)) $list = $data;
    }
    if (!in_array($ip, $list)) {
        $list[] = $ip;
        @file_put_contents($cache_file, json_encode($list), LOCK_EX);
    }

    try {
        $stmt = $pdo->prepare("INSERT IGNORE INTO `blocked_ips` (`ip_address`, `reason`) VALUES (:ip, :reason)");
        $stmt->execute([':ip' => $ip, ':reason' => mb_substr($reason, 0, 250)]);
    } catch (Exception $e) {}
}

// Check if IP is permanently blocked
function is_ip_blocked($pdo, $ip) {
    $cache_file = __DIR__ . '/blocked_ips.json';
    $in_cache = false;
    if (file_exists($cache_file)) {
        $data = @json_decode(file_get_contents($cache_file), true);
        if (is_array($data) && in_array($ip, $data)) {
            $in_cache = true;
        }
    }

    if ($in_cache) {
        // Double-check with MySQL: If admin deleted row in phpMyAdmin, auto-heal and unblock!
        if ($pdo) {
            try {
                $stmt = $pdo->prepare("SELECT id FROM `blocked_ips` WHERE `ip_address` = :ip LIMIT 1");
                $stmt->execute([':ip' => $ip]);
                if ($stmt->fetch()) {
                    return true;
                } else {
                    // Admin removed from phpMyAdmin! Auto-clean from blocked_ips.json
                    if (file_exists($cache_file)) {
                        $list = @json_decode(file_get_contents($cache_file), true);
                        if (is_array($list)) {
                            $list = array_values(array_filter($list, function($item) use ($ip) {
                                return $item !== $ip;
                            }));
                            @file_put_contents($cache_file, json_encode($list), LOCK_EX);
                        }
                    }
                    return false;
                }
            } catch (Exception $e) {
                return true;
            }
        }
        return true;
    }

    // Direct check in DB in case added manually in phpMyAdmin
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT id FROM `blocked_ips` WHERE `ip_address` = :ip LIMIT 1");
            $stmt->execute([':ip' => $ip]);
            if ($stmt->fetch()) {
                return true;
            }
        } catch (Exception $e) {}
    }

    return false;
}

// Anti-flood rate limiting per IP
function check_rate_limit($pdo, $ip) {
    $now = time();
    $cache_file = __DIR__ . '/rate_limits.json';
    $limits = [];
    if (file_exists($cache_file)) {
        $limits = @json_decode(file_get_contents($cache_file), true);
        if (!is_array($limits)) $limits = [];
    }

    // Purge entries older than 60 seconds
    foreach ($limits as $stored_ip => $timestamps) {
        $limits[$stored_ip] = array_values(array_filter($timestamps, function($t) use ($now) {
            return ($now - $t) < 60;
        }));
        if (empty($limits[$stored_ip])) {
            unset($limits[$stored_ip]);
        }
    }

    if (!isset($limits[$ip])) {
        $limits[$ip] = [];
    }

    // Automated bot flood: > 15 requests in 10s = Auto-block
    $last_10s = array_filter($limits[$ip], function($t) use ($now) { return ($now - $t) < 10; });
    if (count($last_10s) >= 15) {
        block_ip($pdo, $ip, 'Automated Bot flood attack detected');
        return 'blocked';
    }

    // YouTube-style rate limit: Max 10 messages per 40 seconds per user
    $last_40s = array_filter($limits[$ip], function($t) use ($now) { return ($now - $t) < 40; });
    if (count($last_40s) >= 10) {
        return 'rate_limited';
    }

    $limits[$ip][] = $now;
    @file_put_contents($cache_file, json_encode($limits), LOCK_EX);
    return 'ok';
}

// Real-Name Validation (Letters, proper length, reject keyboard mash / hallucination)
function validate_real_name($name) {
    $name = trim($name);
    $len = mb_strlen($name, 'UTF-8');
    if ($len < 3 || $len > 30) {
        return 'Name must be between 3 and 30 characters.';
    }

    // Only letters (Latin, Devanagari Hindi), spaces, and dots
    if (!preg_match('/^[\p{L}\s\.]+$/u', $name)) {
        return 'Name must contain only real letters and spaces (no numbers or symbols).';
    }

    // Reject single repeated characters or obvious keyboard mashing
    $clean = mb_strtolower(preg_replace('/[\s\.]+/u', '', $name), 'UTF-8');
    $chars = array_unique(preg_split('//u', $clean, -1, PREG_SPLIT_NO_EMPTY));
    if (count($chars) < 2) {
        return 'Please enter a valid real name.';
    }

    if (preg_match('/(asdf|qwerty|zxcv|1234|qwer|hjkl|aaaa|zzzz)/iu', $clean)) {
        return 'Invalid gibberish name. Please enter your real name.';
    }

    return true;
}

// Validate Email (Strictly @gmail.com or @outlook.com, no fake/gibberish prefixes)
function validate_email($email) {
    $email = trim(mb_strtolower($email, 'UTF-8'));
    if (empty($email)) return false;

    // Check basic email format and allowed domains strictly
    if (!preg_match('/^[a-z0-9]([a-z0-9\._]{2,30})@(gmail\.com|outlook\.com)$/i', $email, $matches)) {
        return 'Email must end with @gmail.com or @outlook.com';
    }

    $prefix = $matches[1];

    // Check for keyboard mashing sequences
    if (preg_match('/(asdf|qwerty|zxcv|hjkl|1234|qwer|yuiop)/i', $prefix)) {
        return 'Please enter a genuine personal email address.';
    }

    // Reject excessive repeating characters (e.g. aaaa@, 1111@)
    if (preg_match('/(.)\1{3,}/', $prefix)) {
        return 'Email contains invalid repeating characters.';
    }

    // Must contain at least one vowel in the prefix
    if (!preg_match('/[aeiou]/i', $prefix)) {
        return 'Please enter a valid, real email address.';
    }

    // Reject 5+ consecutive consonants (unpronounceable random spam strings)
    if (preg_match('/[bcdfghjklmnpqrstvwxyz]{5,}/i', $prefix)) {
        return 'Invalid email address entered.';
    }

    // Reject dummy prefixes
    if (preg_match('/^(test|fake|dummy|temp|sample|spam|random|none|admin|noemail)/i', $prefix)) {
        return 'Disposable or dummy emails are not allowed.';
    }

    return true;
}

// Validate Phone Number (10-digit Indian Mobile, starts with 6-9, reject fake/repeated patterns)
function validate_phone($phone) {
    $phone = trim($phone);
    if (empty($phone)) return false;

    // Clean out country code +91, 0 prefix, spaces, dashes
    $clean = preg_replace('/[\s\-\(\)\.]/', '', $phone);
    if (substr($clean, 0, 3) === '+91') {
        $clean = substr($clean, 3);
    } elseif (substr($clean, 0, 2) === '91' && strlen($clean) === 12) {
        $clean = substr($clean, 2);
    } elseif (substr($clean, 0, 1) === '0' && strlen($clean) === 11) {
        $clean = substr($clean, 1);
    }

    // Must be exactly 10 digits
    if (!preg_match('/^\d{10}$/', $clean)) {
        return 'Phone number must be exactly 10 digits.';
    }

    // Must start with 6, 7, 8, or 9 (Indian Mobile Standard)
    if (!preg_match('/^[6-9]/', $clean)) {
        return 'Mobile number must start with 6, 7, 8, or 9.';
    }

    // Reject all identical digits (e.g. 9999999999, 8888888888, 7777777777, 0000000000)
    if (preg_match('/^(\d)\1{9}$/', $clean)) {
        return 'Fake phone number detected (all identical digits). Please enter your real number.';
    }

    // Reject consecutive identical digits (e.g. 999999xxxx)
    if (preg_match('/(.)\1{5,}/', $clean)) {
        return 'Fake phone number detected (too many repeating digits).';
    }

    // Reject simple sequential numbers
    $fake_sequences = [
        '0123456789', '1234567890', '2345678901', '3456789012',
        '9876543210', '8765432109', '7654321098', '6543210987',
        '9898989898', '9090909090', '9191919191', '9797979797',
        '9999900000', '9876500000', '1212121212'
    ];
    if (in_array($clean, $fake_sequences)) {
        return 'Please enter a genuine, active 10-digit mobile number.';
    }

    // Reject numbers with fewer than 4 unique digits
    $unique_digits = count(array_unique(str_split($clean)));
    if ($unique_digits < 4) {
        return 'Invalid phone number with insufficient unique digits.';
    }

    return true;
}

// Content Moderation Filter: Adult/Porn, Profanity/Abuse (EN/HI), Hate Speech & Religious Insults
function check_inappropriate_content($text) {
    if (empty($text)) return false;
    $text_lower = mb_strtolower($text, 'UTF-8');

    // 1. Adult / 18+ / Pornographic keywords, domains & vulgarities
    $adult_patterns = [
        '/\b(porn|porno|pornography|xxx|sex|sexy|sexx|boobs|pussy|dick|cock|vagina|penis|blowjob|handjob|hardcore|erotic|nude|nudity|naked|gangbang|milf|incest|orgasm|hentai|chaturbate|onlyfans|escort|hooker)\b/iu',
        '/(xvideos|pornhub|xnxx|redtube|xhamster|youporn|brazzers|bangbros|spankbang|eporner|tnaflix|beeg|fapvid)\b/iu',
        '/\.xxx\b|\.porn\b|\.adult\b/iu',
        '/\b(18\+|adult[ -]?content|hot[ -]?mms|leaked[ -]?video|sex[ -]?video)\b/iu',
        '/(चुदाई|चोदना|सेक्स|नंगा|नंगी|स्तन|योनि|लिंग|मुठ|हवस)/u'
    ];

    foreach ($adult_patterns as $pattern) {
        if (preg_match($pattern, $text_lower)) {
            return 'Adult, sexually explicit, or pornographic content is strictly prohibited.';
        }
    }

    // 2. Abusive / Vulgar / Profane words (English, Hindi, Hinglish)
    $abusive_patterns = [
        '/\b(fuck|fucker|fucking|motherfucker|bitch|bastard|asshole|cunt|slut|whore|dickhead|jackass|dipshit|douchebag)\b/iu',
        '/\b(madarchod|madarchodh|mc|bc|behenchod|bhenchod|bhenkelaude|bhosdike|bhosadike|bhosdi|bhosadi|chutiya|chutiye|chut|gandu|gaand|harami|kamina|randi|r@ndi|lodu|lauda|loda|lavde|jhaat|jhat|chodu|bhadwe|bhadwa|tatte|kamine|suar)\b/iu',
        '/(मादरचोद|बहनचोद|भोसड़ीके|भोसडीके|चूतिया|गांडू|गांड|रंडी|हरामी|कमीना|लौड़ा|लंड|झांट|भड़वा|भड़वे|सूअर|कुतिया)/u'
    ];

    foreach ($abusive_patterns as $pattern) {
        if (preg_match($pattern, $text_lower)) {
            return 'Abusive, profane, or vulgar language is strictly prohibited.';
        }
    }

    // 3. Communal abuse, religious insults, slurs, or harassment targeting Hindu deities or sentiments
    $hate_patterns = [
        '/\b(terrorist|katwe|katua|k2a|mulla|mulle|kafir|chamar|bhangi)\b/iu',
        '/(कटवा|मुल्ला|काफिर|जिहादी)/u',
        '/(chhat|chhath|surya|maiya|ram|shiva|krishna|hanuman|hindu).*(fuck|chutiya|randi|gaand|bhosdi|madarchod|bhenchod|dog|suar|piss|cow)/iu'
    ];

    foreach ($hate_patterns as $pattern) {
        if (preg_match($pattern, $text_lower)) {
            return 'Hate speech, religious insults, or communal harassment is strictly prohibited.';
        }
    }

    return false;
}

// Check IP status
$is_blocked = is_ip_blocked($pdo, $client_ip);

$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : 'get_messages');

// Diagnostic test endpoint
if ($action === 'test') {
    $table_exists = false;
    $count = 0;
    if ($pdo) {
        try {
            $check = $pdo->query("SHOW TABLES LIKE 'chat_messages'")->fetchAll();
            $table_exists = count($check) > 0;
            if ($table_exists) {
                $cnt = $pdo->query("SELECT COUNT(*) as cnt FROM `chat_messages`")->fetch();
                $count = (int)$cnt['cnt'];
            }
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'status' => $pdo ? 'MySQL Connected & Ready' : 'Operating in High-Speed Cache Mode',
        'database' => $db_name,
        'host' => $db_host,
        'user' => $db_user,
        'table_exists' => $table_exists,
        'message_count' => $count,
        'client_ip' => $client_ip,
        'is_blocked' => $is_blocked,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// Admin endpoints for recovering and unblocking IPs
$admin_key = isset($_REQUEST['key']) ? trim($_REQUEST['key']) : '';
$is_admin = ($admin_key === $db_pass || $admin_key === 'chhathi_admin_2026');

if ($is_admin) {
    // 1. List all blocked IPs with reasons
    if ($action === 'list_blocked') {
        $db_blocked = [];
        try {
            $stmt = $pdo->query("SELECT * FROM `blocked_ips` ORDER BY id DESC LIMIT 200");
            $db_blocked = $stmt->fetchAll();
        } catch (Exception $e) {}

        $cache_file = __DIR__ . '/blocked_ips.json';
        $file_blocked = file_exists($cache_file) ? @json_decode(file_get_contents($cache_file), true) : [];

        echo json_encode([
            'success' => true,
            'count' => count($db_blocked),
            'blocked_ips_in_db' => $db_blocked,
            'blocked_ips_in_cache' => $file_blocked
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2. Unblock a specific IP
    if ($action === 'unblock') {
        $target_ip = isset($_REQUEST['ip']) ? trim($_REQUEST['ip']) : '';
        if (empty($target_ip)) {
            echo json_encode(['success' => false, 'error' => 'Please provide the IP to unblock. Example: ?action=unblock&ip=1.2.3.4&key=YOUR_KEY']);
            exit;
        }

        // Delete from MySQL
        try {
            $stmt = $pdo->prepare("DELETE FROM `blocked_ips` WHERE `ip_address` = :ip");
            $stmt->execute([':ip' => $target_ip]);
        } catch (Exception $e) {}

        // Delete from local JSON cache file
        $cache_file = __DIR__ . '/blocked_ips.json';
        if (file_exists($cache_file)) {
            $list = @json_decode(file_get_contents($cache_file), true);
            if (is_array($list)) {
                $list = array_values(array_filter($list, function($item) use ($target_ip) {
                    return $item !== $target_ip;
                }));
                @file_put_contents($cache_file, json_encode($list), LOCK_EX);
            }
        }

        echo json_encode([
            'success' => true,
            'message' => "IP {$target_ip} has been successfully unblocked and restored!",
            'target_ip' => $target_ip
        ]);
        exit;
    }

    // 3. Unblock all IPs (Reset ban list)
    if ($action === 'unblock_all') {
        try {
            $pdo->exec("TRUNCATE TABLE `blocked_ips`");
        } catch (Exception $e) {}

        $cache_file = __DIR__ . '/blocked_ips.json';
        @file_put_contents($cache_file, json_encode([]), LOCK_EX);

        echo json_encode([
            'success' => true,
            'message' => 'All banned IPs have been successfully unblocked!'
        ]);
        exit;
    }
}

// Fetch messages with high-concurrency disk cache
if ($action === 'get_messages') {
    $after_id = isset($_GET['after_id']) ? (int)$_GET['after_id'] : 0;
    $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 60;
    $cache_file = __DIR__ . '/messages_cache.json';

    // Fast-path: Check high-speed disk cache first (avoids MySQL connection exhaustion)
    if (file_exists($cache_file)) {
        $cache_time = filemtime($cache_file);
        // Serve from fast cache if cache is less than 3 seconds old or on heavy load
        if ((time() - $cache_time) < 3 || $after_id > 0) {
            $raw = @file_get_contents($cache_file);
            if ($raw) {
                $cached_messages = @json_decode($raw, true);
                if (is_array($cached_messages)) {
                    if ($after_id > 0) {
                        $new_slice = array_values(array_filter($cached_messages, function($m) use ($after_id) {
                            return (int)$m['id'] > $after_id;
                        }));
                        echo json_encode([
                            'success' => true,
                            'is_blocked' => $is_blocked,
                            'messages' => $new_slice,
                            'cached' => true
                        ]);
                        exit;
                    } else {
                        echo json_encode([
                            'success' => true,
                            'is_blocked' => $is_blocked,
                            'messages' => $cached_messages,
                            'cached' => true
                        ]);
                        exit;
                    }
                }
            }
        }
    }

    // Database query fallback
    $messages = [];
    if ($pdo) {
        try {
            if ($after_id > 0) {
                $stmt = $pdo->prepare("SELECT id, name, message, DATE_FORMAT(created_at, '%h:%i %p') as time_formatted, UNIX_TIMESTAMP(created_at) as timestamp FROM `chat_messages` WHERE id > :after_id ORDER BY id ASC LIMIT :limit");
                $stmt->bindValue(':after_id', $after_id, PDO::PARAM_INT);
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->execute();
                $messages = $stmt->fetchAll();
            } else {
                $stmt = $pdo->prepare("SELECT id, name, message, DATE_FORMAT(created_at, '%h:%i %p') as time_formatted, UNIX_TIMESTAMP(created_at) as timestamp FROM (SELECT * FROM `chat_messages` ORDER BY id DESC LIMIT :limit) sub ORDER BY id ASC");
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->execute();
                $messages = $stmt->fetchAll();
                @file_put_contents($cache_file, json_encode($messages), LOCK_EX);
            }
        } catch (Exception $e) {}
    }

    if (empty($messages) && file_exists($cache_file)) {
        $raw = @file_get_contents($cache_file);
        if ($raw) $messages = @json_decode($raw, true) ?: [];
    }

    echo json_encode([
        'success' => true,
        'is_blocked' => $is_blocked,
        'messages' => is_array($messages) ? $messages : []
    ]);
    exit;
}

// Send 6-Digit Email OTP to Devotee
if ($action === 'send_email_otp' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($is_blocked) {
        echo json_encode(['success' => false, 'blocked' => true, 'error' => 'Your IP is permanently blocked.']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $email = isset($data['email']) ? trim(strtolower($data['email'])) : (isset($_POST['email']) ? trim(strtolower($_POST['email'])) : '');
    $name = isset($data['name']) ? trim($data['name']) : (isset($_POST['name']) ? trim($_POST['name']) : '');

    $name_check = validate_real_name($name);
    if ($name_check !== true) {
        echo json_encode(['success' => false, 'error' => $name_check]);
        exit;
    }

    $email_check = validate_email($email);
    if ($email_check !== true) {
        echo json_encode(['success' => false, 'error' => $email_check]);
        exit;
    }

    $otp = sprintf('%06d', mt_rand(100000, 999999));
    $otps_file = __DIR__ . '/email_otps.json';
    $otps = [];
    if (file_exists($otps_file)) {
        $raw_o = @json_decode(file_get_contents($otps_file), true);
        if (is_array($raw_o)) $otps = $raw_o;
    }

    $otps[$email] = [
        'name' => $name,
        'otp' => $otp,
        'otp_hash' => hash('sha256', $otp),
        'expires_at' => time() + 600, // 10 minutes
        'ip' => $client_ip
    ];
    @file_put_contents($otps_file, json_encode($otps), LOCK_EX);

    // Send email using high-reliability multi-provider mailer (Brevo API, SMTP, or PHP mail)
    $provider = 'php_mail';
    $delivered = false;
    if (file_exists(__DIR__ . '/mailer.php')) {
        require_once __DIR__ . '/mailer.php';
        $send_res = send_chhathi_otp_email($email, $name, $otp, 'devotee');
        $provider = isset($send_res['provider']) ? $send_res['provider'] : 'custom';
        $delivered = !empty($send_res['delivered']);
    } else {
        $from_domain = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'chhathimaiya.is-best.net';
        $from_email = "no-reply@" . preg_replace('/^www\./', '', $from_domain);
        $subject = "Chhathi Maiya Chat - Verification Code: {$otp}";
        $body = "Jai Chhathi Maiya!\r\n\r\nHello {$name},\r\n\r\nYour 6-digit verification code to join Chhathi Maiya Public Chat is:\r\n\r\n👉 {$otp} 👈\r\n\r\nThis code will expire in 10 minutes.\r\nMay Chhathi Maiya shower blessings upon you and your family! 🙏🌅";
        $headers = "From: Chhathi Maiya <{$from_email}>\r\n" .
                   "Reply-To: omkumar.working@gmail.com\r\n" .
                   "X-Mailer: PHP/" . phpversion();
        $delivered = @mail($email, $subject, $body, $headers, "-f {$from_email}");
    }

    if ($delivered) {
        echo json_encode([
            'success' => true,
            'message' => "Verification code sent to {$email}. Please check your inbox or spam folder.",
            'provider' => $provider
        ]);
        exit;
    } else {
        $error_detail = "Failed to dispatch email verification code.";
        if (isset($send_res['errors']['brevo_api']) && strpos($send_res['errors']['brevo_api'], 'unrecognised IP address') !== false) {
            $error_detail = "Brevo blocked email delivery: Server IP (13.71.3.99) is not whitelisted. Please turn OFF 'Authorised IP addresses' in Brevo Settings (https://app.brevo.com/security/authorised_ips) or click 'Authorize IP' in the email sent to go.qwiklabs@gmail.com.";
        } elseif (isset($send_res['errors']['smtp_auth']) && strpos($send_res['errors']['smtp_auth'], 'Unauthorized IP') !== false) {
            $error_detail = "Brevo SMTP blocked email: Server IP is unauthorized. Please disable IP restrictions in your Brevo security settings (https://app.brevo.com/security/authorised_ips).";
        }
        echo json_encode([
            'success' => false,
            'error' => $error_detail
        ]);
        exit;
    }
}

// Verify 6-Digit Email OTP
if ($action === 'verify_email_otp' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    $email = isset($data['email']) ? trim(strtolower($data['email'])) : (isset($_POST['email']) ? trim(strtolower($_POST['email'])) : '');
    $otp = isset($data['otp']) ? trim($data['otp']) : (isset($_POST['otp']) ? trim($_POST['otp']) : '');
    $name = isset($data['name']) ? trim($data['name']) : (isset($_POST['name']) ? trim($_POST['name']) : '');

    $otps_file = __DIR__ . '/email_otps.json';
    if (!file_exists($otps_file)) {
        echo json_encode(['success' => false, 'error' => 'No active OTP found. Please request a new code.']);
        exit;
    }

    $otps = @json_decode(file_get_contents($otps_file), true);
    if (!isset($otps[$email])) {
        echo json_encode(['success' => false, 'error' => 'Verification code expired or not found. Please click Resend.']);
        exit;
    }

    $entry = $otps[$email];
    if (time() > $entry['expires_at']) {
        unset($otps[$email]);
        @file_put_contents($otps_file, json_encode($otps), LOCK_EX);
        echo json_encode(['success' => false, 'error' => 'Verification code expired. Please request a new one.']);
        exit;
    }

    if (hash('sha256', $otp) !== $entry['otp_hash']) {
        echo json_encode(['success' => false, 'error' => 'Incorrect 6-digit verification code. Please check your email.']);
        exit;
    }

    // OTP Match! Clean up
    unset($otps[$email]);
    @file_put_contents($otps_file, json_encode($otps), LOCK_EX);

    $final_name = !empty($name) ? $name : $entry['name'];

    // Record verified devotee for Admin Panel
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO `verified_devotees` (`name`, `email`, `method`, `ip_address`) VALUES (:name, :email, 'email', :ip)");
            $stmt->execute([':name' => $final_name, ':email' => $email, ':ip' => $client_ip]);
        } catch (Exception $e) {}
    }

    $dev_file = __DIR__ . '/verified_devotees.json';
    $dev_list = [];
    if (file_exists($dev_file)) {
        $raw_d = @json_decode(file_get_contents($dev_file), true);
        if (is_array($raw_d)) $dev_list = $raw_d;
    }
    $dev_list[] = [
        'id' => time(),
        'name' => $final_name,
        'phone' => '',
        'email' => $email,
        'method' => 'email',
        'ip_address' => $client_ip,
        'created_at' => date('Y-m-d H:i:s')
    ];
    @file_put_contents($dev_file, json_encode($dev_list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    $token = hash_hmac('sha256', $client_ip . '|' . $final_name . '|' . date('Y-m'), $db_pass);

    echo json_encode([
        'success' => true,
        'verified' => true,
        'name' => $final_name,
        'token' => $token,
        'message' => 'Email verified successfully! Welcome to Chhathi Maiya Public Chat.'
    ]);
    exit;
}

// Verify User Onboarding with Name + Phone (from Firebase SMS OTP)
if ($action === 'verify_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($is_blocked) {
        echo json_encode([
            'success' => false,
            'blocked' => true,
            'error' => 'Your IP address has been permanently blocked.'
        ]);
        exit;
    }

    $raw_input = file_get_contents('php://input');
    $input_data = json_decode($raw_input, true);

    $name = isset($input_data['name']) ? trim($input_data['name']) : (isset($_POST['name']) ? trim($_POST['name']) : '');
    $email = isset($input_data['email']) ? trim($input_data['email']) : (isset($_POST['email']) ? trim($_POST['email']) : '');
    $phone = isset($input_data['phone']) ? trim($input_data['phone']) : (isset($_POST['phone']) ? trim($_POST['phone']) : '');

    // Validate Real Name
    $name_check = validate_real_name($name);
    if ($name_check !== true) {
        echo json_encode(['success' => false, 'error' => $name_check]);
        exit;
    }

    // Check for inappropriate words in name
    $name_violation = check_inappropriate_content($name);
    if ($name_violation) {
        block_ip($pdo, $client_ip, 'Inappropriate name during verification');
        echo json_encode(['success' => false, 'blocked' => true, 'error' => $name_violation]);
        exit;
    }

    // Record verified devotee in MySQL for Admin Panel
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO `verified_devotees` (`name`, `phone`, `email`, `method`, `ip_address`) VALUES (:name, :phone, :email, :method, :ip)");
            $stmt->execute([
                ':name' => $name,
                ':phone' => $phone ? $phone : null,
                ':email' => $email ? $email : null,
                ':method' => !empty($phone) ? 'phone' : 'email',
                ':ip' => $client_ip
            ]);
        } catch (Exception $e) {}
    }

    // Also update verified_devotees.json cache
    $dev_file = __DIR__ . '/verified_devotees.json';
    $dev_list = [];
    if (file_exists($dev_file)) {
        $raw_d = @json_decode(file_get_contents($dev_file), true);
        if (is_array($raw_d)) $dev_list = $raw_d;
    }
    $dev_list[] = [
        'id' => time(),
        'name' => $name,
        'phone' => $phone,
        'email' => $email,
        'method' => !empty($phone) ? 'phone' : 'email',
        'ip_address' => $client_ip,
        'created_at' => date('Y-m-d H:i:s')
    ];
    @file_put_contents($dev_file, json_encode($dev_list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    $token = hash_hmac('sha256', $client_ip . '|' . $name . '|' . date('Y-m'), $db_pass);

    echo json_encode([
        'success' => true,
        'verified' => true,
        'name' => $name,
        'token' => $token,
        'message' => 'Verification successful! Welcome to Chhathi Maiya Public Chat.'
    ]);
    exit;
}

// Send message
if ($action === 'send_message' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // If IP is blocked, immediately reject (No bypass via cache clearing)
    if ($is_blocked) {
        echo json_encode([
            'success' => false,
            'blocked' => true,
            'error' => 'Your IP address has been permanently blocked for violating safety rules.'
        ]);
        exit;
    }

    // Honeypot bot trap
    if (!empty($_POST['website_hp']) || !empty($_POST['contact_email_hp'])) {
        block_ip($pdo, $client_ip, 'Bot honeypot triggered');
        echo json_encode(['success' => false, 'blocked' => true, 'error' => 'Bot activity detected.']);
        exit;
    }

    // Rate limit check (10 messages per 40 seconds)
    $rate_status = check_rate_limit($pdo, $client_ip);
    if ($rate_status === 'blocked') {
        echo json_encode([
            'success' => false,
            'blocked' => true,
            'error' => 'Automated spam flood detected. Your IP has been permanently blocked.'
        ]);
        exit;
    } elseif ($rate_status === 'rate_limited') {
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'rate_limited' => true,
            'cooldown' => 10,
            'error' => 'Your Message Speed is Fast Try after 10 Sec'
        ]);
        exit;
    }

    $raw_input = file_get_contents('php://input');
    $input_data = json_decode($raw_input, true);

    $name = '';
    $message = '';

    if (is_array($input_data)) {
        $name = isset($input_data['name']) ? trim($input_data['name']) : '';
        $message = isset($input_data['message']) ? trim($input_data['message']) : '';
    }

    if (empty($name) && isset($_POST['name'])) {
        $name = trim($_POST['name']);
    }
    if (empty($message) && isset($_POST['message'])) {
        $message = trim($_POST['message']);
    }

    // Mandate real name validation
    $name_check = validate_real_name($name);
    if ($name_check !== true) {
        echo json_encode(['success' => false, 'error' => $name_check]);
        exit;
    }

    $message = mb_substr($message, 0, 400, 'UTF-8');
    if (empty($message)) {
        echo json_encode(['success' => false, 'error' => 'Message cannot be empty.']);
        exit;
    }

    // Check for inappropriate content in name or message
    $violation_reason = check_inappropriate_content($message);
    if (!$violation_reason) {
        $violation_reason = check_inappropriate_content($name);
    }

    if ($violation_reason) {
        // PERMANENTLY BLOCK IP
        block_ip($pdo, $client_ip, $violation_reason . ' Message: ' . mb_substr($message, 0, 100));

        echo json_encode([
            'success' => false,
            'blocked' => true,
            'error' => $violation_reason . ' Your IP has been permanently blocked.'
        ]);
        exit;
    }

    // XSS Sanitization
    $name = htmlspecialchars(strip_tags($name), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $message = htmlspecialchars(strip_tags($message), ENT_QUOTES | ENT_HTML5, 'UTF-8');

    $new_id = time();
    $cache_file = __DIR__ . '/messages_cache.json';
    $fresh = [];
    if (file_exists($cache_file)) {
        $raw = @file_get_contents($cache_file);
        if ($raw) $fresh = @json_decode($raw, true) ?: [];
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO `chat_messages` (`name`, `message`) VALUES (:name, :message)");
            $stmt->execute([
                ':name' => $name,
                ':message' => $message
            ]);
            $new_id = (int)$pdo->lastInsertId();
        } catch (Exception $e) {
            if (strpos($e->getMessage(), "doesn't exist") !== false || strpos($e->getMessage(), "42S02") !== false) {
                ensure_tables_exist($pdo);
                try {
                    $stmt = $pdo->prepare("INSERT INTO `chat_messages` (`name`, `message`) VALUES (:name, :message)");
                    $stmt->execute([
                        ':name' => $name,
                        ':message' => $message
                    ]);
                    $new_id = (int)$pdo->lastInsertId();
                } catch (Exception $e2) {}
            }
        }
    }

    $new_msg = [
        'id' => (int)$new_id,
        'name' => $name,
        'message' => $message,
        'time_formatted' => date('h:i A'),
        'timestamp' => time()
    ];
    $fresh[] = $new_msg;
    if (count($fresh) > 100) $fresh = array_slice($fresh, -100);
    @file_put_contents($cache_file, json_encode($fresh), LOCK_EX);

    echo json_encode([
        'success' => true,
        'message' => $new_msg
    ]);
    exit;
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
