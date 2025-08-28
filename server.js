const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

const { getOrbcommClient } = require('./utils/orbcomm');
const { getClientByApiKey, validateClientAccess } = require('./config/clients');
const { errorHandler } = require('./middleware/auth');
const apiRoutes = require('./routes/api');

// Initialize Express app
const app = express();
const wsInstance = expressWs(app);

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'orbcomm-api-server' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Create logs directory
const fs = require('fs');
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(`🌐 ${req.method} ${req.url} - ${req.ip}`);
  }
  
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    apiKey: req.headers['x-api-key'] ? 'provided' : 'missing'
  });
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode < 400 ? '✅' : res.statusCode < 500 ? '⚠️' : '❌';
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`${statusColor} ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
    
    logger.info(`Response: ${req.method} ${req.url}`, {
      statusCode: res.statusCode,
      duration: duration,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const orbcommClient = getOrbcommClient();
  const status = orbcommClient.getConnectionStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    orbcomm: {
      connected: status.connected,
      devicesTracked: status.devicesTracked,
      reconnectAttempts: status.reconnectAttempts,
      lastHeartbeat: new Date(status.lastHeartbeat).toISOString()
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// Serve static files from public directory
app.use(express.static('public'));

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API routes
app.use('/api', apiRoutes);

// WebSocket endpoint for real-time KAGU asset updates
app.ws('/ws/kagu', (ws, req) => {
  const apiKey = req.query.apiKey;
  const clientIp = req.ip;
  
  console.log(`🔗 WebSocket connection attempt from ${clientIp}`);
  logger.info('WebSocket connection attempt for KAGU client', { ip: clientIp });
  
  // Authenticate WebSocket connection
  if (!apiKey) {
    console.log('❌ WebSocket rejected: No API key provided');
    logger.warn('WebSocket rejected: No API key provided', { ip: clientIp });
    ws.close(1008, 'API key required');
    return;
  }
  
  const client = getClientByApiKey(apiKey);
  if (!client || client.id !== 'KAGU') {
    console.log('❌ WebSocket rejected: Invalid API key or access denied');
    logger.warn('WebSocket rejected: Invalid API key or access denied', { ip: clientIp, apiKey: apiKey.substring(0, 10) + '...' });
    ws.close(1008, 'Invalid API key or client access denied');
    return;
  }
  
  // Check real-time permission
  if (!client.permissions.realTime) {
    console.log('❌ WebSocket rejected: Real-time access not permitted');
    logger.warn('WebSocket rejected: Real-time access not permitted', { ip: clientIp });
    ws.close(1008, 'Real-time access not permitted');
    return;
  }
  
  console.log('✅ WebSocket authenticated for KAGU client');
  logger.info('WebSocket authenticated for KAGU client', { ip: clientIp });
  
  // Set up message handler for KAGU client
  const orbcommClient = getOrbcommClient();
  const { validateClientAccess } = require('./config/clients');
  
  let messagesSent = 0;
  
  const messageHandler = (assetData) => {
    try {
      // Filter messages for KAGU assets (KAGU* and SLTU* patterns)
      if (validateClientAccess('KAGU', assetData.assetId)) {
        const clientMessage = {
          clientId: 'KAGU',
          assetId: assetData.assetId,
          deviceId: assetData.deviceId,
          timestamp: assetData.timestamp,
          eventClass: assetData.eventClass,
          gpsData: assetData.gpsData,
          deviceData: assetData.deviceData,
          reeferData: assetData.reeferData,
          receivedAt: new Date().toISOString()
        };
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(clientMessage));
          messagesSent++;
          
          if (process.env.LOG_LEVEL === 'debug') {
            console.log(`📤 WebSocket sent asset update #${messagesSent}: ${assetData.assetId}`);
          }
          
          logger.debug('WebSocket message sent', { 
            assetId: assetData.assetId, 
            messageNumber: messagesSent,
            ip: clientIp 
          });
        }
      }
    } catch (error) {
      console.log(`❌ WebSocket message error: ${error.message}`);
      logger.error('Error sending WebSocket message:', error);
    }
  };
  
  // Add message handler
  const removeHandler = orbcommClient.addMessageHandler(messageHandler);
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    clientId: 'KAGU',
    status: 'connected',
    timestamp: new Date().toISOString(),
    assetPatterns: client.assetPatterns,
    totalAssets: client.totalAssets,
    permissions: client.permissions
  }));
  
  // Handle WebSocket close
  ws.on('close', (code, reason) => {
    console.log(`📤 WebSocket closed: ${code} - ${reason} (sent ${messagesSent} messages)`);
    logger.info(`WebSocket closed for KAGU client: ${code} - ${reason}`, { 
      ip: clientIp, 
      messagesSent: messagesSent 
    });
    removeHandler();
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.log(`❌ WebSocket error: ${error.message}`);
    logger.error('WebSocket error for KAGU client:', error, { ip: clientIp });
    removeHandler();
  });
  
  // Handle ping/pong for connection health
  ws.on('ping', () => {
    ws.pong();
  });
  
  // Send periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        orbcommStatus: orbcommClient.getConnectionStatus()
      }));
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000);
  
  ws.on('close', () => {
    clearInterval(heartbeatInterval);
  });
});

// Serve static documentation
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ORBCOMM API Server',
    version: process.env.npm_package_version || '1.0.0',
    description: 'KAGU ORBCOMM satellite tracking API with real-time WebSocket support',
    client: 'KAGU',
    assetPatterns: ['KAGU*', 'SLTU*'],
    endpoints: {
      health: '/health',
      documentation: '/docs',
      dashboard: '/dashboard',
      api: {
        assets: '/api/kagu/assets',
        allAssets: '/api/kagu/assets/all',
        offlineAssets: '/api/kagu/assets/offline',
        latest: '/api/kagu/asset/{ASSET_ID}/latest',
        detailed: '/api/kagu/asset/{ASSET_ID}/detailed',
        status: '/api/kagu/asset/{ASSET_ID}/status',
        events: '/api/kagu/asset/{ASSET_ID}/events',
        gps: '/api/kagu/asset/{ASSET_ID}/gps',
        reefer: '/api/kagu/asset/{ASSET_ID}/reefer',
        history: '/api/kagu/asset/{ASSET_ID}/history?days=30',
        track: '/api/kagu/asset/{ASSET_ID}/track?from=date&to=date',
        temperatureTrend: '/api/kagu/asset/{ASSET_ID}/temperatures/trend',
        dailyReport: '/api/kagu/reports/daily?date=YYYY-MM-DD',
        analyticsSummary: '/api/kagu/analytics/summary'
      },
      websocket: '/ws/kagu?apiKey={API_KEY}'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, async () => {
  console.log('🚀 ORBCOMM API Server Starting...');
  console.log(`🌐 Server: http://${HOST}:${PORT}`);
  console.log(`📚 Documentation: http://${HOST}:${PORT}/docs`);
  console.log(`🖥️ Dashboard: http://${HOST}:${PORT}/dashboard`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  
  logger.info(`ORBCOMM API Server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info(`Documentation available at: http://${HOST}:${PORT}/docs`);
  logger.info(`Dashboard available at: http://${HOST}:${PORT}/dashboard`);
  
  // Initialize Database
  console.log('🔗 Initializing Database connection...');
  try {
    const { initializeDatabase } = require('./database');
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    logger.info('Database initialized successfully');
  } catch (error) {
    console.log('⚠️  Database initialization failed, continuing without persistence');
    logger.warn('Database initialization failed:', error);
  }

  // Initialize ORBCOMM connection
  console.log('🔗 Initializing ORBCOMM WebSocket connection...');
  const orbcommClient = getOrbcommClient();
  orbcommClient.connect();
  
  logger.info('ORBCOMM WebSocket client initialized');
  
  // Log connection status every 30 seconds in debug mode
  if (process.env.LOG_LEVEL === 'debug') {
    setInterval(() => {
      const status = orbcommClient.getConnectionStatus();
      console.log(`📊 ORBCOMM Status: Connected=${status.connected}, Assets=${status.assetsTracked}, Events=${status.totalEventsReceived}`);
    }, 30000);
  }
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  const orbcommClient = getOrbcommClient();
  orbcommClient.disconnect();
  
  // Close database connection
  try {
    const { closeDatabase } = require('./database');
    await closeDatabase();
    logger.info('Database connection closed');
  } catch (error) {
    logger.warn('Error closing database:', error);
  }
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed. Exiting process.');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;