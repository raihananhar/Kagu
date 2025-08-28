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
        asset_id, latitude, longitude, timestamp, event_id
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    const gps = eventData.gpsData;
    await connection.execute(locationQuery, [
      eventData.assetId,
      gps.latitude || null,
      gps.longitude || null,
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


  async getAssetHistory(assetId, days = 30) {
    const query = `
      SELECT 
        e.id, e.sequence_id, e.asset_id, e.device_id,
        e.event_type, e.event_time, e.device_time, e.received_time,
        l.latitude, l.longitude,
        t.ambient, t.setpoint, t.supply1, t.return1
      FROM events e
      LEFT JOIN locations l ON e.id = l.event_id
      LEFT JOIN temperatures t ON e.id = t.event_id
      WHERE e.asset_id = ? 
        AND e.received_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY e.received_time DESC
      LIMIT 1000
    `;
    
    const results = await this.db.execute(query, [assetId, days]);
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