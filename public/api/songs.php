<?php
// Dynamic Playlist API with MySQL DB Persistence for Chhathi Maiya Music Player
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

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
            CREATE TABLE IF NOT EXISTS `songs` (
                `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                `title` VARCHAR(255) NOT NULL,
                `title_en` VARCHAR(255) DEFAULT NULL,
                `artist` VARCHAR(255) DEFAULT NULL,
                `duration` INT DEFAULT 300,
                `duration_formatted` VARCHAR(20) DEFAULT '5:00',
                `cover_url` TEXT DEFAULT NULL,
                `youtube_id` VARCHAR(64) DEFAULT NULL,
                `youtube_music_url` TEXT DEFAULT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
    } catch (Exception $e) {}
}

$songs = [];
if ($pdo) {
    try {
        $stmt = $pdo->query("SELECT id, title, title_en as titleEn, artist, duration, duration_formatted as durationFormatted, cover_url as coverUrl, youtube_id as youtubeId, youtube_music_url as youtubeMusicUrl FROM `songs` ORDER BY created_at ASC");
        $songs = $stmt->fetchAll();
    } catch (Exception $e) {}
}

$songs_file = __DIR__ . '/songs.json';

// If DB is empty, read from songs.json or default playlist, and seed DB
if (empty($songs)) {
    if (file_exists($songs_file)) {
        $raw = @file_get_contents($songs_file);
        if ($raw) {
            $parsed = @json_decode($raw, true);
            if (is_array($parsed) && count($parsed) > 0) {
                $songs = $parsed;
            }
        }
    }

    if (empty($songs)) {
        $songs = [
            [
                'id' => '6e6Hp6R5SVU',
                'title' => 'उग हे सूरज देव',
                'titleEn' => 'Uga Hai Suraj Dev',
                'artist' => 'Anuradha Paudwal',
                'duration' => 353,
                'durationFormatted' => '5:53',
                'coverUrl' => 'https://i.ytimg.com/vi/6e6Hp6R5SVU/maxresdefault.jpg',
                'youtubeId' => '6e6Hp6R5SVU',
                'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=6e6Hp6R5SVU'
            ],
            [
                'id' => 'Eyq7vfxu4iA',
                'title' => 'काँच ही बाँस के बहंगिया',
                'titleEn' => 'Kaanch Hi Baans Ke Bahangiya',
                'artist' => 'Anuradha Paudwal',
                'duration' => 339,
                'durationFormatted' => '5:39',
                'coverUrl' => 'https://i.ytimg.com/vi/Eyq7vfxu4iA/sddefault.jpg',
                'youtubeId' => 'Eyq7vfxu4iA',
                'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=Eyq7vfxu4iA'
            ],
            [
                'id' => 'BKoD7bTLc2k',
                'title' => 'जोड़े जोड़े फलवा',
                'titleEn' => 'Jode Jode Falwa',
                'artist' => 'Pawan Singh',
                'duration' => 327,
                'durationFormatted' => '5:27',
                'coverUrl' => 'https://i.ytimg.com/vi/BKoD7bTLc2k/maxresdefault.jpg',
                'youtubeId' => 'BKoD7bTLc2k',
                'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=BKoD7bTLc2k'
            ],
            [
                'id' => 'y7hrM7PouQM',
                'title' => 'केलवा के पात पर',
                'titleEn' => 'Kelwa Ke Paat Par',
                'artist' => 'Sharda Sinha',
                'duration' => 527,
                'durationFormatted' => '8:47',
                'coverUrl' => 'https://i.ytimg.com/vi/y7hrM7PouQM/maxresdefault.jpg',
                'youtubeId' => 'y7hrM7PouQM',
                'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=y7hrM7PouQM'
            ]
        ];
        @file_put_contents($songs_file, json_encode($songs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    // Seed MySQL songs table
    if ($pdo && is_array($songs)) {
        $stmt = $pdo->prepare("REPLACE INTO `songs` (id, title, title_en, artist, duration, duration_formatted, cover_url, youtube_id, youtube_music_url) VALUES (:id, :title, :title_en, :artist, :dur, :dur_f, :cover, :yt_id, :yt_m)");
        foreach ($songs as $s) {
            try {
                $stmt->execute([
                    ':id' => $s['id'],
                    ':title' => $s['title'],
                    ':title_en' => isset($s['titleEn']) ? $s['titleEn'] : $s['title'],
                    ':artist' => isset($s['artist']) ? $s['artist'] : 'Chhath Bhakti',
                    ':dur' => isset($s['duration']) ? (int)$s['duration'] : 300,
                    ':dur_f' => isset($s['durationFormatted']) ? $s['durationFormatted'] : '5:00',
                    ':cover' => isset($s['coverUrl']) ? $s['coverUrl'] : '',
                    ':yt_id' => isset($s['youtubeId']) ? $s['youtubeId'] : $s['id'],
                    ':yt_m' => isset($s['youtubeMusicUrl']) ? $s['youtubeMusicUrl'] : ''
                ]);
            } catch (Exception $e) {}
        }
    }
}

echo json_encode([
    'success' => true,
    'songs' => array_values($songs),
    'mysql_online' => ($pdo !== null)
]);
