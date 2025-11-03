-- Migration: Add device_data table for storing battery and power information
-- Date: 2025-11-03

-- Create device_data table
CREATE TABLE IF NOT EXISTS `device_data` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `asset_id` varchar(50) NOT NULL,
  `event_id` int(11) NOT NULL,
  `ext_power` tinyint(1) DEFAULT NULL,
  `ext_power_voltage` decimal(5,2) DEFAULT NULL,
  `battery_voltage` decimal(4,2) DEFAULT NULL,
  `device_temp` decimal(5,2) DEFAULT NULL,
  `rssi` varchar(10) DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_event_id` (`event_id`),
  KEY `idx_timestamp` (`timestamp`),
  CONSTRAINT `fk_device_data_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for faster queries (check if exists first)
CREATE INDEX idx_asset_timestamp ON device_data(asset_id, timestamp);

-- Add GPS quality columns to locations table
ALTER TABLE `locations`
  ADD COLUMN `gps_lock_state` varchar(20) DEFAULT NULL AFTER `longitude`,
  ADD COLUMN `satellite_count` int(11) DEFAULT NULL AFTER `gps_lock_state`;
