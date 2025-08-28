const dbConnection = require('./connection');
const DatabaseSchema = require('./schema');
const DatabaseOperations = require('./operations');
const logger = require('../utils/logger');

let dbOps = null;
let isInitialized = false;

async function initializeDatabase() {
  if (isInitialized) {
    return dbOps;
  }

  try {
    // Initialize connection
    await dbConnection.initialize();
    
    // Initialize schema
    const schema = new DatabaseSchema(dbConnection);
    await schema.initializeSchema();
    
    // Create operations instance
    dbOps = new DatabaseOperations(dbConnection);
    
    isInitialized = true;
    logger.info('Database system initialized successfully');
    
    return dbOps;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

function getDatabaseOperations() {
  if (!isInitialized || !dbOps) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbOps;
}

function isConnected() {
  return isInitialized && dbConnection.isConnected();
}

async function getHealthStatus() {
  if (!isConnected()) {
    return {
      connected: false,
      error: 'Database not initialized'
    };
  }
  
  try {
    await dbConnection.execute('SELECT 1');
    
    const schema = new DatabaseSchema(dbConnection);
    const tableInfo = await schema.getTableInfo();
    
    return {
      connected: true,
      database: process.env.DB_NAME || 'orbcomm_kagu',
      host: process.env.DB_HOST || 'localhost',
      tables: tableInfo
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

async function closeDatabase() {
  if (dbConnection) {
    await dbConnection.close();
    isInitialized = false;
    dbOps = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabaseOperations,
  isConnected,
  getHealthStatus,
  closeDatabase,
  connection: dbConnection
};