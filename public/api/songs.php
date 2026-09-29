<?php
// Dynamic Playlist API for Chhathi Maiya Music Player
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$songs_file = __DIR__ . '/songs.json';

if (file_exists($songs_file)) {
    $raw = @file_get_contents($songs_file);
    if ($raw) {
        $songs = @json_decode($raw, true);
        if (is_array($songs) && count($songs) > 0) {
            echo json_encode(['success' => true, 'songs' => $songs]);
            exit;
        }
    }
}

// Fallback to default playlist
$default_tracks = [
    [
        'id' => '6e6Hp6R5SVU',
        'title' => 'उग हे सूरज देव',
        'titleEn' => 'Uga Hai Suraj Dev',
        'artist' => 'Anuradha Paudwal',
        'duration' => 353,
        'durationFormatted' => '5:53',
        'coverUrl' => 'https://i.ytimg.com/vi/6e6Hp6R5SVU/maxresdefault.jpg',
        'youtubeId' => '6e6Hp6R5SVU',
        'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=6e6Hp6R5SVU&list=PLdafLAOyWKH4'
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
        'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=Eyq7vfxu4iA&list=PLdafLAOyWKH4'
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
        'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=BKoD7bTLc2k&list=PLdafLAOyWKH4'
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
        'youtubeMusicUrl' => 'https://music.youtube.com/watch?v=y7hrM7PouQM&list=PLdafLAOyWKH4'
    ]
];

@file_put_contents($songs_file, json_encode($default_tracks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

echo json_encode(['success' => true, 'songs' => $default_tracks]);
