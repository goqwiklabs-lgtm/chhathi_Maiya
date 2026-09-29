<?php
// Chhathi Maiya Transactional Email Engine
// Supports: Brevo REST API v3 (cURL over HTTPS), SMTP Socket (port 587), and native PHP mail()

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

function get_mailer_config() {
    $config_file = __DIR__ . '/mailer_config.json';
    $local_file = __DIR__ . '/mailer_config.local.json';

    $defaults = [
        'brevo_api_key' => sec_decrypt('1b030d1807010b7206560250020b0b55460a5e3a5354515502095a554d0c0d685001070455585907460a5e3900555004535f0a05175d0c6d07555350050d5853110a5c670b5557504e1d5a03123b033d5b4943663a11582c26'),
        'smtp_host' => sec_decrypt('10051c11591a0c3353491c54110d1e0e5a0b0632'),
        'smtp_port' => 587,
        'smtp_user' => sec_decrypt('010a0951115b596f0370415b17184503060d1f301c535d5b'),
        'smtp_pass' => sec_decrypt('1b1b0515041b003d1f04540605090b02405a0b68575156550009095340510d3b05520303515e5850125a0b685402575451585f03100b5c3a00055757050e0d51460d0b6a0a09575305450c1803392a6d566851642f3c20501f18'),
        'sender_email' => sec_decrypt('0407461003010233535241760405090818460a305f'),
        'sender_name' => 'Chhathi Maiya Puja'
    ];

    // Priority 1: Local uncommitted credentials (for local dev and production hosting)
    if (file_exists($local_file)) {
        $loaded = @json_decode(file_get_contents($local_file), true);
        if (is_array($loaded)) {
            return array_merge($defaults, array_filter($loaded, function($v) {
                return !empty($v) && strpos($v, 'YOUR_') === false;
            }));
        }
    }

    // Priority 2: Standard config file (ignore template placeholders)
    if (file_exists($config_file)) {
        $loaded = @json_decode(file_get_contents($config_file), true);
        if (is_array($loaded)) {
            $filtered = array_filter($loaded, function($v) {
                return !empty($v) && strpos($v, 'YOUR_') === false;
            });
            return array_merge($defaults, $filtered);
        }
    }

    return $defaults;
}

function send_chhathi_otp_email($to_email, $to_name, $otp, $type = 'devotee') {
    $cfg = get_mailer_config();
    $to_email = trim(strtolower($to_email));
    $to_name = trim($to_name);
    if (empty($to_name)) $to_name = 'Devotee';

    if ($type === 'admin') {
        $subject = "Chhathi Maiya Admin - Password Reset OTP: {$otp}";
        $heading = "Admin Security Verification";
        $intro = "Your verification code to reset the Administrator password is:";
    } else {
        $subject = "Chhathi Maiya Chat - Your Verification Code: {$otp}";
        $heading = "Jai Chhathi Maiya! 🙏🌅";
        $intro = "Hello <strong>" . htmlspecialchars($to_name, ENT_QUOTES, 'UTF-8') . "</strong>,<br>Your 6-digit verification code to join Chhathi Maiya Public Chat is:";
    }

    // HTML Email Template with Festive Styling
    $html_content = '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>' . htmlspecialchars($subject, ENT_QUOTES, 'UTF-8') . '</title>
</head>
<body style="margin:0;padding:24px;background-color:#120703;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#fef3c7;">
  <div style="max-width:520px;margin:0 auto;background:linear-gradient(145deg, #1c0b05, #2d1207);border-radius:18px;border:1px solid #f59e0b;padding:32px 24px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
    <div style="font-size:36px;margin-bottom:8px;">🪔 🌅 🪔</div>
    <h1 style="color:#fbbf24;font-size:22px;margin:0 0 16px;font-weight:700;">' . $heading . '</h1>
    <p style="color:#fde68a;font-size:14px;line-height:1.6;margin:0 0 24px;">' . $intro . '</p>
    
    <div style="background:rgba(0,0,0,0.5);border:2px dashed #f59e0b;border-radius:14px;padding:18px;margin:0 auto 24px;max-width:280px;">
      <div style="color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;opacity:0.8;">One-Time Verification Code</div>
      <div style="color:#fef08a;font-family:monospace;font-size:34px;font-weight:bold;letter-spacing:8px;line-height:1;">' . $otp . '</div>
    </div>

    <p style="color:#f59e0b;font-size:12px;margin:0 0 20px;">⏱️ This code will expire in <strong>10 minutes</strong>.<br>Please do not share this code with anyone.</p>
    
    <hr style="border:0;border-top:1px solid rgba(245,158,11,0.25);margin:24px 0;">
    
    <p style="color:#d97706;font-size:11px;margin:0;line-height:1.5;">
      Chhath Puja Mahaparv — Chhathi Maiya Apni Kripa Sabhi Par Banaye Rakhein.<br>
      <span style="opacity:0.7;">Official Chhathi Maiya Live Portal • chhathimaiya.is-best.net</span>
    </p>
  </div>
</body>
</html>';

    $text_content = "Jai Chhathi Maiya!\r\n\r\n" .
                    strip_tags($intro) . "\r\n\r\n" .
                    "👉 OTP: {$otp} 👈\r\n\r\n" .
                    "This code will expire in 10 minutes.\r\n" .
                    "May Chhathi Maiya bless you and your family! 🙏🌅\r\n\r\n" .
                    "chhathimaiya.is-best.net";

    $delivered = false;
    $provider = 'none';
    $error_log = [];

    // METHOD 1: Brevo REST API v3 via cURL (HTTPS port 443, 100% open on InfinityFree)
    if (!empty($cfg['brevo_api_key'])) {
        $ch = curl_init('https://api.brevo.com/v3/smtp/email');
        $payload = [
            'sender' => [
                'name' => $cfg['sender_name'],
                'email' => $cfg['sender_email']
            ],
            'to' => [
                [
                    'email' => $to_email,
                    'name' => $to_name
                ]
            ],
            'subject' => $subject,
            'htmlContent' => $html_content,
            'textContent' => $text_content
        ];

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'api-key: ' . $cfg['brevo_api_key'],
            'Content-Type: application/json',
            'Accept: application/json'
        ]);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_err = curl_error($ch);
        curl_close($ch);

        if ($http_code === 200 || $http_code === 201) {
            $delivered = true;
            $provider = 'brevo_api';
        } else {
            $error_log['brevo_api'] = "HTTP {$http_code}: " . $response . ($curl_err ? " (cURL: {$curl_err})" : "");
        }
    }

    // METHOD 2: Direct SMTP Socket to smtp-relay.brevo.com:587 (if outbound port open)
    if (!$delivered && !empty($cfg['smtp_pass'])) {
        $fp = @fsockopen($cfg['smtp_host'], (int)$cfg['smtp_port'], $errno, $errstr, 1.5);
        if ($fp) {
            stream_set_timeout($fp, 2);
            $smtp_read = function($sock) {
                $out = '';
                while ($l = fgets($sock, 512)) {
                    $out .= $l;
                    if (substr($l, 3, 1) === ' ') break;
                }
                return $out;
            };

            $smtp_read($fp);
            fputs($fp, "EHLO chhathimaiya.is-best.net\r\n");
            $smtp_read($fp);
            fputs($fp, "STARTTLS\r\n");
            $tls_resp = $smtp_read($fp);

            if (substr($tls_resp, 0, 3) === '220' && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                fputs($fp, "EHLO chhathimaiya.is-best.net\r\n");
                $smtp_read($fp);
                fputs($fp, "AUTH LOGIN\r\n");
                $smtp_read($fp);
                fputs($fp, base64_encode($cfg['smtp_user']) . "\r\n");
                $smtp_read($fp);
                fputs($fp, base64_encode($cfg['smtp_pass']) . "\r\n");
                $auth_resp = $smtp_read($fp);

                if (substr($auth_resp, 0, 3) === '235') {
                    fputs($fp, "MAIL FROM: <{$cfg['sender_email']}>\r\n");
                    $smtp_read($fp);
                    fputs($fp, "RCPT TO: <{$to_email}>\r\n");
                    $smtp_read($fp);
                    fputs($fp, "DATA\r\n");
                    $smtp_read($fp);

                    $mime_boundary = '----=_Part_' . md5(time());
                    $headers = "From: =?UTF-8?B?" . base64_encode($cfg['sender_name']) . "?= <{$cfg['sender_email']}>\r\n" .
                               "To: =?UTF-8?B?" . base64_encode($to_name) . "?= <{$to_email}>\r\n" .
                               "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n" .
                               "MIME-Version: 1.0\r\n" .
                               "Content-Type: multipart/alternative; boundary=\"{$mime_boundary}\"\r\n\r\n";

                    $body = "--{$mime_boundary}\r\n" .
                            "Content-Type: text/plain; charset=UTF-8\r\n" .
                            "Content-Transfer-Encoding: 8bit\r\n\r\n" .
                            $text_content . "\r\n\r\n" .
                            "--{$mime_boundary}\r\n" .
                            "Content-Type: text/html; charset=UTF-8\r\n" .
                            "Content-Transfer-Encoding: 8bit\r\n\r\n" .
                            $html_content . "\r\n\r\n" .
                            "--{$mime_boundary}--\r\n.\r\n";

                    fputs($fp, $headers . $body);
                    $data_resp = $smtp_read($fp);
                    if (substr($data_resp, 0, 3) === '250') {
                        $delivered = true;
                        $provider = 'brevo_smtp';
                    }
                    fputs($fp, "QUIT\r\n");
                } else {
                    $error_log['smtp_auth'] = trim($auth_resp);
                }
            }
            fclose($fp);
        } else {
            $error_log['smtp_connect'] = "Port {$cfg['smtp_port']} blocked or timeout ({$errno}: {$errstr})";
        }
    }

    // METHOD 3: Native PHP mail() function (Configured specifically for InfinityFree Sendmail)
    if (!$delivered) {
        $from_domain = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'chhathimaiya.is-best.net';
        $from_email = "no-reply@" . preg_replace('/^www\./', '', $from_domain);
        $headers = "MIME-Version: 1.0\r\n" .
                   "Content-type: text/html; charset=UTF-8\r\n" .
                   "From: =?UTF-8?B?" . base64_encode($cfg['sender_name']) . "?= <{$from_email}>\r\n" .
                   "Reply-To: {$cfg['sender_email']}\r\n" .
                   "X-Mailer: PHP/" . phpversion();

        $mail_result = @mail($to_email, $subject, $html_content, $headers, "-f {$from_email}");
        if ($mail_result) {
            $delivered = true;
            $provider = 'php_mail';
        } else {
            $error_log['php_mail'] = 'mail() returned false';
        }
    }

    // Log transaction for audit and troubleshooting
    $log_file = __DIR__ . '/mailer_log.json';
    $logs = [];
    if (file_exists($log_file)) {
        $logs = @json_decode(file_get_contents($log_file), true);
        if (!is_array($logs)) $logs = [];
    }
    $logs[] = [
        'timestamp' => date('Y-m-d H:i:s'),
        'to' => $to_email,
        'type' => $type,
        'delivered' => $delivered,
        'provider' => $provider,
        'errors' => $error_log
    ];
    if (count($logs) > 50) $logs = array_slice($logs, -50);
    @file_put_contents($log_file, json_encode($logs, JSON_PRETTY_PRINT), LOCK_EX);

    return [
        'success' => $delivered,
        'delivered' => $delivered,
        'provider' => $provider,
        'errors' => $error_log
    ];
}

