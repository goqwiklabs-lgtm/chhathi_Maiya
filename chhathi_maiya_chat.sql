-- phpMyAdmin SQL Dump
-- Database: chhathi_maiya_public_chat
-- Complete Database Architecture for Chhathi Maiya Puja Live Platform

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+05:30";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------
-- Table structure for table `chat_messages`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` text DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `sender_ip` varchar(45) DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `is_pinned` tinyint(1) NOT NULL DEFAULT 0,
  `pinned_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created` (`created_at`),
  KEY `idx_pinned` (`is_pinned`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `blocked_ips`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `blocked_ips` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `blocked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_ip` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for table `verified_devotees`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `verified_devotees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `phone` varchar(25) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `avatar_url` text DEFAULT NULL,
  `method` varchar(20) DEFAULT 'email',
  `ip_address` varchar(45) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dev_ip` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for table `online_users`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `online_users` (
  `session_id` varchar(100) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `devotee_id` int(11) DEFAULT NULL,
  `devotee_name` varchar(100) DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `last_seen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_id`),
  KEY `idx_online_seen` (`last_seen`),
  KEY `idx_online_ip` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for table `songs`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `songs` (
  `id` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,
  `title_en` varchar(255) DEFAULT NULL,
  `artist` varchar(255) DEFAULT NULL,
  `duration` int(11) DEFAULT 300,
  `duration_formatted` varchar(20) DEFAULT '5:00',
  `cover_url` text DEFAULT NULL,
  `youtube_id` varchar(64) DEFAULT NULL,
  `youtube_music_url` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for table `admin_settings`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `admin_settings` (
  `setting_key` varchar(64) NOT NULL,
  `setting_value` text NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Initial Seed: Notice Message & Default Songs
-- --------------------------------------------------------

INSERT INTO `chat_messages` (`id`, `name`, `message`, `is_admin`, `is_pinned`, `pinned_at`, `created_at`) VALUES
(1, 'Admin', 'Chhath Puja Aane wali hai! Taiyaar Rahee, Chhathi Maiya Apni Kripa sb par krengi 🙏🌅', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `message`=VALUES(`message`), `is_pinned`=VALUES(`is_pinned`);

INSERT INTO `songs` (`id`, `title`, `title_en`, `artist`, `duration`, `duration_formatted`, `cover_url`, `youtube_id`, `youtube_music_url`) VALUES
('6e6Hp6R5SVU', 'उग हे सूरज देव', 'Uga Hai Suraj Dev', 'Anuradha Paudwal', 353, '5:53', 'https://i.ytimg.com/vi/6e6Hp6R5SVU/maxresdefault.jpg', '6e6Hp6R5SVU', 'https://music.youtube.com/watch?v=6e6Hp6R5SVU'),
('Eyq7vfxu4iA', 'काँच ही बाँस के बहंगिया', 'Kaanch Hi Baans Ke Bahangiya', 'Anuradha Paudwal', 339, '5:39', 'https://i.ytimg.com/vi/Eyq7vfxu4iA/sddefault.jpg', 'Eyq7vfxu4iA', 'https://music.youtube.com/watch?v=Eyq7vfxu4iA'),
('BKoD7bTLc2k', 'जोड़े जोड़े फलवा', 'Jode Jode Falwa', 'Pawan Singh', 327, '5:27', 'https://i.ytimg.com/vi/BKoD7bTLc2k/maxresdefault.jpg', 'BKoD7bTLc2k', 'https://music.youtube.com/watch?v=BKoD7bTLc2k'),
('y7hrM7PouQM', 'केलवा के पात पर', 'Kelwa Ke Paat Par', 'Sharda Sinha', 527, '8:47', 'https://i.ytimg.com/vi/y7hrM7PouQM/maxresdefault.jpg', 'y7hrM7PouQM', 'https://music.youtube.com/watch?v=y7hrM7PouQM')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
