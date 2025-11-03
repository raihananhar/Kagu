const logger = require('../utils/logger');

class DatabaseOperations {
  constructor(dbConnection) {
    this.db = dbConnection;
  }

  async storeEvent(eventData) {
    const connection = await this.db.beginTransaction();
    
    try {
      // Store main event
      const eventQuery = `
        INSERT INTO events (
          sequence_id, asset_id, device_id, event_type, 
          event_time, device_time, received_time, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const eventTime = eventData.timestamp ? new Date(eventData.timestamp) : null;
      const deviceTime = eventData.deviceTime ? new Date(eventData.deviceTime) : null;
      const receivedTime = new Date();
      
      const [eventResult] = await connection.execute(eventQuery, [
        eventData.sequenceId || null,
        eventData.assetId,
        eventData.deviceId,
        eventData.eventClass || eventData.eventType,
        eventTime,
        deviceTime,
        receivedTime,
        JSON.stringify(eventData)
      ]);
      
      const eventId = eventResult.insertId;
      
      // Store GPS data if available
      if (eventData.gpsData) {
        await this.storeLocation(connection, eventData, eventId);
      }

      // Store temperature data if available
      if (eventData.reeferData) {
        await this.storeTemperature(connection, eventData, eventId);
      }

      // Store device data if available (battery, power, etc)
      if (eventData.deviceData) {
        await this.storeDeviceData(connection, eventData, eventId);
      }

      // Store alarm data if available
      if (eventData.reeferData || eventData.deviceData) {
        await this.storeAlarms(connection, eventData, eventId);
      }

      // Asset status is handled by the ORBCOMM client in memory
      
      await connection.commit();
      connection.release();
      
      logger.debug('Event stored successfully', { 
        assetId: eventData.assetId, 
        eventId: eventId 
      });
      
      return eventId;
    } catch (error) {
      await connection.rollback();
      connection.release();
      logger.error('Failed to store event:', error);
      throw error;
    }
  }

  async storeLocation(connection, eventData, eventId) {
    if (!eventData.gpsData || !eventData.gpsData.hasGPS) return;

    const locationQuery = `
      INSERT INTO locations (
        asset_id, latitude, longitude, gps_lock_state, satellite_count, timestamp, event_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const gps = eventData.gpsData;
    await connection.execute(locationQuery, [
      eventData.assetId,
      gps.latitude || null,
      gps.longitude || null,
      gps.lockState || null,
      gps.satelliteCount || null,
      eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
      eventId
    ]);
  }

  async storeTemperature(connection, eventData, eventId) {
    if (!eventData.reeferData || !eventData.reeferData.hasReeferData) return;

    const tempQuery = `
      INSERT INTO temperatures (
        asset_id, ambient, setpoint, supply1, return1, timestamp, event_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const reefer = eventData.reeferData;
    await connection.execute(tempQuery, [
      eventData.assetId,
      reefer.ambientTemp || null,
      reefer.setTemp || null,
      reefer.supplyTemp1 || null,
      reefer.returnTemp1 || null,
      eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
      eventId
    ]);
  }

  async storeDeviceData(connection, eventData, eventId) {
    if (!eventData.deviceData) return;

    const deviceQuery = `
      INSERT INTO device_data (
        asset_id, event_id, ext_power, ext_power_voltage,
        battery_voltage, device_temp, rssi, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const device = eventData.deviceData;
    await connection.execute(deviceQuery, [
      eventData.assetId,
      eventId,
      device.extPower !== undefined ? device.extPower : null,
      device.extPowerVoltage || null,
      device.batteryVoltage || null,
      device.deviceTemp || null,
      device.rssi || null,
      eventData.timestamp ? new Date(eventData.timestamp) : new Date()
    ]);
  }

  async storeAlarms(connection, eventData, eventId) {
    const alarms = [];
    const timestamp = eventData.timestamp ? new Date(eventData.timestamp) : new Date();

    // Check for reefer alarms
    if (eventData.reeferData) {
      const reefer = eventData.reeferData;

      // Primary alarm from alarmCode
      if (reefer.alarmCode) {
        alarms.push({
          code: reefer.alarmCode,
          status: reefer.alarmStatus || 'active',
          type: 'reefer_alarm'
        });
      }

      // Additional alarms from reeferAlarms array
      if (reefer.reeferAlarms && Array.isArray(reefer.reeferAlarms)) {
        reefer.reeferAlarms.forEach(alarmCode => {
          // Avoid duplicate if already added from alarmCode
          if (!alarms.find(a => a.code === alarmCode)) {
            alarms.push({
              code: alarmCode,
              status: 'active',
              type: 'reefer_alarm'
            });
          }
        });
      }
    }

    // Check for device alarms (low battery, power failure, etc)
    if (eventData.deviceData) {
      const device = eventData.deviceData;

      // Low battery alarm
      if (device.batteryVoltage && device.batteryVoltage < 3.3) {
        alarms.push({
          code: 'LB',
          status: 'active',
          type: 'device_alarm'
        });
      }

      // External power failure
      if (device.extPower === false) {
        alarms.push({
          code: 'PF',
          status: 'active',
          type: 'device_alarm'
        });
      }
    }

    // Store each alarm
    if (alarms.length > 0) {
      const alarmQuery = `
        INSERT INTO alarms (
          asset_id, event_id, alarm_code, alarm_status,
          alarm_type, severity, description, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const alarm of alarms) {
        const severity = this.getAlarmSeverity(alarm.code);
        const description = this.getAlarmDescription(alarm.code);

        await connection.execute(alarmQuery, [
          eventData.assetId,
          eventId,
          alarm.code,
          alarm.status,
          alarm.type,
          severity,
          description,
          timestamp
        ]);
      }
    }
  }

  getAlarmSeverity(alarmCode) {
    if (!alarmCode) return 'info';

    const code = alarmCode.toString().toUpperCase();

    // Critical alarms
    const critical = ['CF', 'COMPRESSOR_FAIL', 'PF', 'POWER_FAIL', 'SF', 'SENSOR_FAIL', 'SOS'];
    if (critical.includes(code)) return 'critical';

    // Warning alarms
    const warning = ['TH', 'TEMP_HIGH', 'TL', 'TEMP_LOW', 'LB', 'LOW_BATTERY', 'DA', 'DEFROST_ALARM'];
    if (warning.includes(code)) return 'warning';

    return 'info';
  }

  getAlarmDescription(alarmCode) {
    if (!alarmCode) return null;

    const code = alarmCode.toString().toUpperCase();
    const descriptions = {
      'TH': 'High temperature alarm',
      'TEMP_HIGH': 'High temperature alarm',
      'TL': 'Low temperature alarm',
      'TEMP_LOW': 'Low temperature alarm',
      'HH': 'High humidity alarm',
      'HUMIDITY_HIGH': 'High humidity alarm',
      'HL': 'Low humidity alarm',
      'HUMIDITY_LOW': 'Low humidity alarm',
      'DO': 'Door open alarm',
      'DOOR_OPEN': 'Door open alarm',
      'PF': 'Power failure alarm',
      'POWER_FAIL': 'Power failure alarm',
      'LB': 'Low battery alarm',
      'LOW_BATTERY': 'Low battery alarm',
      'CF': 'Compressor failure',
      'COMPRESSOR_FAIL': 'Compressor failure',
      'SF': 'Sensor failure',
      'SENSOR_FAIL': 'Sensor failure',
      'DA': 'Defrost alarm',
      'DEFROST_ALARM': 'Defrost alarm',
      'EA': 'Engine alarm',
      'ENGINE_ALARM': 'Engine alarm',
      'MT': 'Maintenance alarm',
      'MAINTENANCE': 'Maintenance alarm',
      'OS': 'Overspeed alarm',
      'OVERSPEED': 'Overspeed alarm',
      'GF': 'Geofence violation',
      'GEOFENCE': 'Geofence violation',
      'PN': 'Panic alarm',
      'PANIC': 'Panic alarm',
      'SOS': 'SOS emergency alarm'
    };

    return descriptions[code] || `Alarm: ${alarmCode}`;
  }


  async getAssetHistory(assetId, days = 30) {
    // Get main event data
    const query = `
      SELECT
        e.id, e.sequence_id, e.asset_id, e.device_id,
        e.event_type, e.event_time, e.device_time, e.received_time,
        l.latitude, l.longitude, l.gps_lock_state, l.satellite_count,
        t.ambient, t.setpoint, t.supply1, t.return1,
        d.ext_power, d.ext_power_voltage, d.battery_voltage,
        d.device_temp, d.rssi
      FROM events e
      LEFT JOIN locations l ON e.id = l.event_id
      LEFT JOIN temperatures t ON e.id = t.event_id
      LEFT JOIN device_data d ON e.id = d.event_id
      WHERE e.asset_id = ?
        AND e.received_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY e.received_time DESC
      LIMIT 1000
    `;

    const results = await this.db.execute(query, [assetId, days]);

    // Get alarms for these events
    if (results.length > 0) {
      const eventIds = results.map(r => r.id);
      const placeholders = eventIds.map(() => '?').join(',');

      const alarmQuery = `
        SELECT
          event_id, alarm_code, alarm_status, alarm_type,
          severity, description, timestamp
        FROM alarms
        WHERE event_id IN (${placeholders})
        ORDER BY timestamp DESC
      `;

      const alarms = await this.db.execute(alarmQuery, eventIds);

      // Group alarms by event_id
      const alarmsByEvent = {};
      alarms.forEach(alarm => {
        if (!alarmsByEvent[alarm.event_id]) {
          alarmsByEvent[alarm.event_id] = [];
        }
        alarmsByEvent[alarm.event_id].push(alarm);
      });

      // Attach alarms to results
      results.forEach(result => {
        result.alarms = alarmsByEvent[result.id] || [];
      });
    }

    return results;
  }

  async getAssetTrack(assetId, fromDate, toDate) {
    const query = `
      SELECT 
        l.latitude, l.longitude, l.timestamp, e.event_type
      FROM locations l
      JOIN events e ON l.event_id = e.id
      WHERE l.asset_id = ? 
        AND l.timestamp BETWEEN ? AND ?
        AND l.latitude IS NOT NULL 
        AND l.longitude IS NOT NULL
      ORDER BY l.timestamp ASC
    `;
    
    const results = await this.db.execute(query, [assetId, fromDate, toDate]);
    return results;
  }

  async getTemperatureTrend(assetId, days = 7) {
    const query = `
      SELECT 
        ambient, setpoint, supply1, return1, timestamp
      FROM temperatures 
      WHERE asset_id = ? 
        AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND ambient IS NOT NULL
      ORDER BY timestamp ASC
    `;
    
    const results = await this.db.execute(query, [assetId, days]);
    return results;
  }


  async getDailyReport(date) {
    const queries = {
      totalEvents: `
        SELECT COUNT(*) as count 
        FROM events 
        WHERE DATE(received_time) = ?
      `,
      uniqueAssets: `
        SELECT COUNT(DISTINCT asset_id) as count 
        FROM events 
        WHERE DATE(received_time) = ?
      `,
      eventsByType: `
        SELECT event_type, COUNT(*) as count 
        FROM events 
        WHERE DATE(received_time) = ?
        GROUP BY event_type
      `,
      avgTemperature: `
        SELECT AVG(ambient) as avg_ambient, AVG(setpoint) as avg_setpoint
        FROM temperatures 
        WHERE DATE(timestamp) = ?
      `
    };
    
    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      results[key] = await this.db.execute(query, [date]);
    }
    
    return results;
  }

  async getAnalyticsSummary() {
    const queries = {
      totalEvents: `SELECT COUNT(*) as count FROM events`,
      totalAssets: `SELECT COUNT(DISTINCT asset_id) as count FROM events`,
      eventsLast24h: `
        SELECT COUNT(*) as count 
        FROM events 
        WHERE received_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `,
      assetsWithGPS: `
        SELECT COUNT(DISTINCT asset_id) as count 
        FROM locations 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      `,
      assetsWithTemperature: `
        SELECT COUNT(DISTINCT asset_id) as count 
        FROM temperatures 
        WHERE ambient IS NOT NULL
      `,
      recentLocations: `
        SELECT l.asset_id, l.latitude, l.longitude, l.timestamp
        FROM locations l
        INNER JOIN (
          SELECT asset_id, MAX(timestamp) as max_timestamp
          FROM locations
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          GROUP BY asset_id
        ) latest ON l.asset_id = latest.asset_id AND l.timestamp = latest.max_timestamp
        ORDER BY l.timestamp DESC
        LIMIT 10
      `,
      temperatureStats: `
        SELECT 
          MIN(ambient) as min_temp,
          MAX(ambient) as max_temp,
          AVG(ambient) as avg_temp,
          COUNT(*) as readings_count
        FROM temperatures 
        WHERE ambient IS NOT NULL 
          AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `
    };
    
    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      results[key] = await this.db.execute(query);
    }
    
    return results;
  }
}

module.exports = DatabaseOperations;