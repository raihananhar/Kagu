const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.dbConfig = {
      host: process.env.DATABASE_HOST || 'localhost',
      port: process.env.DATABASE_PORT || 3306,
      user: process.env.DATABASE_USER || 'orbcomm_user',
      password: process.env.DATABASE_PASSWORD || 'sog506',
      database: process.env.DATABASE_NAME || 'orbcomm_kagu',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 30000,
      charset: 'utf8mb4',
      timezone: 'Z',
      connectTimeout: 20000,
      ssl: false
    };
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  async initialize() {
    const maxRetries = this.maxReconnectAttempts;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Database connection attempt ${attempt}/${maxRetries}...`);
        
        // First, create connection without database to check if database exists
        const tempConfig = { ...this.dbConfig };
        delete tempConfig.database;
        
        logger.info(`Connecting to ${tempConfig.host}:${tempConfig.port} as ${tempConfig.user}`);
        const tempConnection = await mysql.createConnection(tempConfig);
        
        // Create database if it doesn't exist
        await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.dbConfig.database}\``);
        logger.info(`Database '${this.dbConfig.database}' created/verified`);
        await tempConnection.end();
        
        // Now create the pool with the database
        this.pool = mysql.createPool(this.dbConfig);
        
        // Test the connection with timeout
        const connection = await Promise.race([
          this.pool.getConnection(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 15000)
          )
        ]);
        
        await connection.ping();
        connection.release();
        
        logger.info(`✅ MySQL connection established: ${this.dbConfig.host}:${this.dbConfig.port}/${this.dbConfig.database}`);
        this.reconnectAttempts = 0;
        return true;
        
      } catch (error) {
        lastError = error;
        logger.warn(`Database connection attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = this.reconnectDelay * attempt;
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error('All database connection attempts failed. MySQL connection could not be established.');
    logger.error('');
    logger.error('🔧 MySQL Configuration Required:');
    logger.error('1. Ensure MySQL service is running');
    logger.error('2. Verify database credentials are correct');
    logger.error('3. Check if database exists and user has proper permissions');
    logger.error('4. Verify network connectivity to MySQL server');
    
    throw lastError;
  }

  async getConnection() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool.getConnection();
  }

  async execute(query, params = []) {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    
    try {
      const [results] = await this.pool.execute(query, params);
      return results;
    } catch (error) {
      logger.error('Database query error:', { query, params, error: error.message });
      throw error;
    }
  }

  async query(query, params = []) {
    return this.execute(query, params);
  }

  async beginTransaction() {
    const connection = await this.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection pool closed');
    }
  }

  isConnected() {
    return this.pool !== null;
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;