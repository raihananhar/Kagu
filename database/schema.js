const logger = require('../utils/logger');

class DatabaseSchema {
  constructor(dbConnection) {
    this.db = dbConnection;
  }

  async initializeSchema() {
    try {
      logger.info('Initializing database schema...');
      
      await this.createEventsTable();
      await this.createLocationsTable();
      await this.createTemperaturesTable();
      
      logger.info('Database schema initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  async createEventsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sequence_id INT,
        asset_id VARCHAR(50) NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        event_type VARCHAR(100),
        event_time DATETIME,
        device_time DATETIME,
        received_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        raw_data JSON,
        INDEX idx_asset_time (asset_id, event_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await this.db.execute(query);
    logger.debug('Events table created/verified');
  }

  async createLocationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_id VARCHAR(50) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        timestamp DATETIME,
        event_id INT,
        INDEX idx_asset_location (asset_id, timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await this.db.execute(query);
    logger.debug('Locations table created/verified');
  }

  async createTemperaturesTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS temperatures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_id VARCHAR(50) NOT NULL,
        ambient DECIMAL(5, 2),
        setpoint DECIMAL(5, 2),
        supply1 DECIMAL(5, 2),
        return1 DECIMAL(5, 2),
        timestamp DATETIME,
        event_id INT,
        INDEX idx_asset_temp (asset_id, timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await this.db.execute(query);
    logger.debug('Temperatures table created/verified');
  }


  async checkTablesExist() {
    const tables = ['events', 'locations', 'temperatures'];
    const results = {};
    
    for (const table of tables) {
      const query = `
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?
      `;
      const [rows] = await this.db.execute(query, [process.env.DATABASE_NAME || 'orbcomm_kagu', table]);
      results[table] = rows[0].count > 0;
    }
    
    return results;
  }

  async getTableInfo() {
    const info = {};
    const tables = ['events', 'locations', 'temperatures'];
    
    for (const table of tables) {
      try {
        const [rows] = await this.db.execute(`SELECT COUNT(*) as count FROM ${table}`);
        info[table] = {
          exists: true,
          rowCount: rows[0].count
        };
      } catch (error) {
        info[table] = {
          exists: false,
          error: error.message
        };
      }
    }
    
    return info;
  }
}

module.exports = DatabaseSchema;