-- Migration: Add alarms table for storing alarm/alert history
-- Date: 2025-11-03

-- Create alarms table
CREATE TABLE IF NOT EXISTS `alarms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `asset_id` varchar(50) NOT NULL,
  `event_id` int(11) NOT NULL,
  `alarm_code` varchar(50) DEFAULT NULL,
  `alarm_status` varchar(20) DEFAULT NULL,
  `alarm_type` varchar(50) DEFAULT NULL COMMENT 'reefer_alarm, device_alarm, gps_alarm, geofence_alarm',
  `severity` varchar(20) DEFAULT NULL COMMENT 'critical, warning, info',
  `description` text DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_event_id` (`event_id`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_alarm_code` (`alarm_code`),
  KEY `idx_alarm_status` (`alarm_status`),
  CONSTRAINT `fk_alarms_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for faster alarm queries
CREATE INDEX idx_asset_alarm_timestamp ON alarms(asset_id, alarm_status, timestamp);
CREATE INDEX idx_alarm_type_severity ON alarms(alarm_type, severity);
