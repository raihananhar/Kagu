const express = require('express');
const moment = require('moment');
const { getOrbcommClient } = require('../utils/orbcomm');
const { getClientById, validateClientAccess, filterAssetsForClient } = require('../config/clients');
const { getDatabaseOperations, isConnected: isDatabaseConnected } = require('../database');
const {
  authenticateApiKey,
  validateClientAccess: validateClientAccessMiddleware,
  validateDeviceAccess: validateAssetAccess,
  checkPermissions,
  createRateLimiter,
  validateQueryParams
} = require('../middleware/auth');

const router = express.Router();

// Apply authentication and rate limiting to all API routes
router.use(authenticateApiKey);
router.use(createRateLimiter);

// GET /api/kagu/assets - List only online KAGU assets 
router.get('/kagu/assets', 
  validateClientAccessMiddleware,
  validateQueryParams,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Get only online KAGU client assets
      const onlineAssets = orbcommClient.getOnlineAssetsForClient('KAGU');
      
      // Apply pagination
      const paginatedAssets = onlineAssets.slice(offset, offset + limit);
      
      // Transform response
      const assets = paginatedAssets.map(asset => ({
        assetId: asset.assetId,
        deviceId: asset.deviceId,
        status: asset.status,
        lastSeen: asset.lastUpdate || asset.timestamp,
        eventClass: asset.eventClass,
        gpsData: asset.gpsData || { hasGPS: false },
        deviceData: asset.deviceData || {},
        reeferData: asset.reeferData || { hasReeferData: false },
        lastKnownLocation: asset.lastKnownLocation
      }));
      
      res.json({
        clientId: 'KAGU',
        assets,
        pagination: {
          total: onlineAssets.length,
          limit,
          offset,
          hasMore: offset + limit < onlineAssets.length
        },
        summary: {
          totalExpected: 10,
          online: onlineAssets.length,
          offline: 10 - onlineAssets.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching KAGU assets:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch KAGU assets'
      });
    }
  }
);

// GET /api/kagu/assets/all - List all KAGU assets (online + offline)
router.get('/kagu/assets/all', 
  validateClientAccessMiddleware,
  validateQueryParams,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Get all KAGU client assets (including offline)
      const allAssets = orbcommClient.getAllAssetsForClient('KAGU');
      
      // Apply pagination
      const paginatedAssets = allAssets.slice(offset, offset + limit);
      
      // Transform response
      const assets = paginatedAssets.map(asset => ({
        assetId: asset.assetId,
        deviceId: asset.deviceId,
        status: asset.status,
        lastUpdate: asset.lastUpdate,
        offlineDuration: asset.offlineDuration,
        eventClass: asset.eventClass,
        gpsData: asset.gpsData || { hasGPS: false },
        deviceData: asset.deviceData || {},
        reeferData: asset.reeferData || { hasReeferData: false },
        lastKnownLocation: asset.lastKnownLocation
      }));
      
      const onlineCount = allAssets.filter(a => a.status === 'online').length;
      const offlineCount = allAssets.filter(a => a.status === 'offline').length;
      const neverSeenCount = allAssets.filter(a => a.status === 'never_seen').length;
      
      res.json({
        clientId: 'KAGU',
        assets,
        pagination: {
          total: allAssets.length,
          limit,
          offset,
          hasMore: offset + limit < allAssets.length
        },
        summary: {
          totalExpected: 10,
          online: onlineCount,
          offline: offlineCount,
          neverSeen: neverSeenCount
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching all KAGU assets:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch all KAGU assets'
      });
    }
  }
);

// GET /api/kagu/assets/offline - List only offline KAGU assets
router.get('/kagu/assets/offline', 
  validateClientAccessMiddleware,
  validateQueryParams,
  async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Get only offline KAGU client assets
      const offlineAssets = orbcommClient.getOfflineAssetsForClient('KAGU');
      
      // Apply pagination
      const paginatedAssets = offlineAssets.slice(offset, offset + limit);
      
      // Transform response
      const assets = paginatedAssets.map(asset => ({
        assetId: asset.assetId,
        deviceId: asset.deviceId,
        status: asset.status,
        lastUpdate: asset.lastUpdate,
        offlineDuration: asset.offlineDuration,
        eventClass: asset.eventClass,
        hasGPS: asset.gpsData.hasGPS,
        hasReeferData: asset.reeferData.hasReeferData,
        extPower: asset.deviceData.extPower,
        batteryVoltage: asset.deviceData.batteryVoltage,
        lastKnownLocation: asset.lastKnownLocation
      }));
      
      res.json({
        clientId: 'KAGU',
        assets,
        pagination: {
          total: offlineAssets.length,
          limit,
          offset,
          hasMore: offset + limit < offlineAssets.length
        },
        summary: {
          totalExpected: 10,
          offline: offlineAssets.length,
          online: 10 - offlineAssets.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching offline KAGU assets:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch offline KAGU assets'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/latest - Latest data for specific asset
router.get('/kagu/asset/:ASSET_ID/latest',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('realTime'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { format = 'json' } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Try to get current data first
      let assetData = orbcommClient.getAssetData(ASSET_ID);
      
      // If no current data, check if it's an expected asset and get from all assets
      if (!assetData) {
        const allAssets = orbcommClient.getAllAssetsForClient('KAGU');
        assetData = allAssets.find(asset => asset.assetId === ASSET_ID);
      }
      
      if (!assetData) {
        return res.status(404).json({
          error: 'Asset not found',
          message: 'This asset is not accessible to KAGU client or does not exist'
        });
      }
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        deviceId: assetData.deviceId,
        status: assetData.status,
        timestamp: assetData.timestamp, // For backward compatibility
        eventTimestamp: assetData.eventTimestamp,
        deviceTimestamp: assetData.deviceTimestamp,
        receivedTimestamp: assetData.receivedTimestamp,
        lastUpdate: assetData.lastUpdate,
        offlineDuration: assetData.offlineDuration,
        receivedAt: assetData.receivedAt,
        eventClass: assetData.eventClass,
        timeLags: assetData.timeLags,
        gpsData: assetData.gpsData,
        deviceData: assetData.deviceData,
        reeferData: assetData.reeferData,
        lastKnownLocation: assetData.lastKnownLocation
      };
      
      // Handle different response formats
      switch (format) {
        case 'csv':
          const csvData = convertToCSV([responseData]);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_latest.csv"`);
          return res.send(csvData);
          
        case 'xml':
          const xmlData = convertToXML(responseData);
          res.setHeader('Content-Type', 'application/xml');
          return res.send(xmlData);
          
        default:
          return res.json(responseData);
      }
      
    } catch (error) {
      console.error('Error fetching latest asset data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch latest asset data'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/gps - GPS data for specific asset
router.get('/kagu/asset/:ASSET_ID/gps',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('gps'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { format = 'json' } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Try to get current data first
      let assetData = orbcommClient.getAssetData(ASSET_ID);
      
      // If no current data, check if it's an expected asset and get from all assets
      if (!assetData) {
        const allAssets = orbcommClient.getAllAssetsForClient('KAGU');
        assetData = allAssets.find(asset => asset.assetId === ASSET_ID);
      }
      
      if (!assetData) {
        return res.status(404).json({
          error: 'Asset not found',
          message: 'This asset is not accessible to KAGU client or does not exist'
        });
      }
      
      // Check if GPS data is available or if we have last known location
      const hasCurrentGPS = assetData.gpsData?.hasGPS;
      const hasLastKnownLocation = assetData.lastKnownLocation;
      
      if (!hasCurrentGPS && !hasLastKnownLocation) {
        return res.status(404).json({
          error: 'GPS data not available',
          message: 'This asset does not have GPS data or last known location'
        });
      }
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        deviceId: assetData.deviceId,
        status: assetData.status,
        timestamp: assetData.timestamp,
        eventTimestamp: assetData.eventTimestamp,
        deviceTimestamp: assetData.deviceTimestamp,
        receivedTimestamp: assetData.receivedTimestamp,
        lastUpdate: assetData.lastUpdate,
        offlineDuration: assetData.offlineDuration,
        timeLags: assetData.timeLags,
        gps: hasCurrentGPS ? {
          latitude: assetData.gpsData.latitude,
          longitude: assetData.gpsData.longitude,
          hasGPS: assetData.gpsData.hasGPS
        } : {
          latitude: hasLastKnownLocation?.latitude || null,
          longitude: hasLastKnownLocation?.longitude || null,
          hasGPS: false,
          isLastKnown: true,
          lastKnownTimestamp: hasLastKnownLocation?.timestamp || null
        }
      };
      
      // Handle different response formats
      switch (format) {
        case 'csv':
          const csvData = convertToCSV([responseData]);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_gps.csv"`);
          return res.send(csvData);
          
        case 'xml':
          const xmlData = convertToXML(responseData);
          res.setHeader('Content-Type', 'application/xml');
          return res.send(xmlData);
          
        default:
          return res.json(responseData);
      }
      
    } catch (error) {
      console.error('Error fetching GPS data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch GPS data'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/reefer - Reefer data for specific asset
router.get('/kagu/asset/:ASSET_ID/reefer',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('reefer'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { format = 'json' } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Try to get current data first
      let assetData = orbcommClient.getAssetData(ASSET_ID);
      
      // If no current data, check if it's an expected asset and get from all assets
      if (!assetData) {
        const allAssets = orbcommClient.getAllAssetsForClient('KAGU');
        assetData = allAssets.find(asset => asset.assetId === ASSET_ID);
      }
      
      if (!assetData) {
        return res.status(404).json({
          error: 'Asset not found',
          message: 'This asset is not accessible to KAGU client or does not exist'
        });
      }
      
      if (!assetData.reeferData?.hasReeferData) {
        return res.status(404).json({
          error: 'Reefer data not available',
          message: 'This asset does not have reefer data'
        });
      }
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        deviceId: assetData.deviceId,
        status: assetData.status,
        timestamp: assetData.timestamp,
        eventTimestamp: assetData.eventTimestamp,
        deviceTimestamp: assetData.deviceTimestamp,
        receivedTimestamp: assetData.receivedTimestamp,
        lastUpdate: assetData.lastUpdate,
        offlineDuration: assetData.offlineDuration,
        timeLags: assetData.timeLags,
        reefer: {
          assetId: assetData.reeferData.assetId,
          ambientTemp: assetData.reeferData.ambientTemp,
          setTemp: assetData.reeferData.setTemp,
          supplyTemp1: assetData.reeferData.supplyTemp1,
          returnTemp1: assetData.reeferData.returnTemp1,
          hasReeferData: assetData.reeferData.hasReeferData
        }
      };
      
      // Handle different response formats
      switch (format) {
        case 'csv':
          const csvData = convertToCSV([responseData]);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_reefer.csv"`);
          return res.send(csvData);
          
        case 'xml':
          const xmlData = convertToXML(responseData);
          res.setHeader('Content-Type', 'application/xml');
          return res.send(xmlData);
          
        default:
          return res.json(responseData);
      }
      
    } catch (error) {
      console.error('Error fetching reefer data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch reefer data'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/detailed - Complete sensor data
router.get('/kagu/asset/:ASSET_ID/detailed',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('realTime'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { format = 'json' } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Try to get current data first
      let assetData = orbcommClient.getAssetData(ASSET_ID);
      
      // If no current data, check if it's an expected asset and get from all assets
      if (!assetData) {
        const allAssets = orbcommClient.getAllAssetsForClient('KAGU');
        assetData = allAssets.find(asset => asset.assetId === ASSET_ID);
      }
      
      if (!assetData) {
        return res.status(404).json({
          error: 'Asset not found',
          message: 'This asset is not accessible to KAGU client or does not exist'
        });
      }
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        deviceId: assetData.deviceId,
        status: assetData.status,
        eventClass: assetData.eventClass,
        eventTypes: assetData.eventTypes,
        primaryEventType: assetData.primaryEventType,
        
        // Complete timestamp information
        timestamps: {
          event: assetData.eventTimestamp,
          device: assetData.deviceTimestamp,
          received: assetData.receivedTimestamp,
          lastUpdate: assetData.lastUpdate
        },
        timeLags: assetData.timeLags,
        
        // Complete GPS data with quality metrics
        gpsData: assetData.gpsData,
        
        // Complete device data with all sensors
        deviceData: assetData.deviceData,
        
        // Complete reefer data with all temperature sensors
        reeferData: assetData.reeferData,
        
        // Geofence information
        geofenceData: assetData.geofenceData,
        
        // Status tracking
        offlineDuration: assetData.offlineDuration,
        lastKnownLocation: assetData.lastKnownLocation
      };
      
      // Handle different response formats
      switch (format) {
        case 'csv':
          const csvData = convertDetailedToCSV([responseData]);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_detailed.csv"`);
          return res.send(csvData);
          
        case 'xml':
          const xmlData = convertToXML(responseData);
          res.setHeader('Content-Type', 'application/xml');
          return res.send(xmlData);
          
        default:
          return res.json(responseData);
      }
      
    } catch (error) {
      console.error('Error fetching detailed asset data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch detailed asset data'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/status - Device status (power, signal, etc)
router.get('/kagu/asset/:ASSET_ID/status',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('realTime'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { format = 'json' } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Try to get current data first
      let assetData = orbcommClient.getAssetData(ASSET_ID);
      
      // If no current data, check if it's an expected asset and get from all assets
      if (!assetData) {
        const allAssets = orbcommClient.getAllAssetsForClient('KAGU');
        assetData = allAssets.find(asset => asset.assetId === ASSET_ID);
      }
      
      if (!assetData) {
        return res.status(404).json({
          error: 'Asset not found',
          message: 'This asset is not accessible to KAGU client or does not exist'
        });
      }
      
      const device = assetData.deviceData || {};
      const gps = assetData.gpsData || {};
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        deviceId: assetData.deviceId,
        status: assetData.status,
        lastUpdate: assetData.lastUpdate,
        offlineDuration: assetData.offlineDuration,
        
        // Power status
        power: {
          external: {
            connected: device.extPower,
            voltage: device.extPowerVoltage
          },
          battery: {
            voltage: device.batteryVoltage
          }
        },
        
        // Signal and network status
        communication: {
          rssi: device.rssi,
          network: {
            mcc: device.mcc,
            mnc: device.mnc,
            lac: device.lac,
            cellId: device.cellId
          }
        },
        
        // GPS status and quality
        gpsStatus: {
          hasGPS: gps.hasGPS,
          lockState: gps.lockState,
          satelliteCount: gps.satelliteCount,
          lastKnownLocation: assetData.lastKnownLocation
        },
        
        // Device health
        deviceHealth: {
          temperature: device.deviceTemp,
          firmware: device.firmwareVersion,
          hardware: device.hardwareVersion,
          model: device.deviceModel
        },
        
        // Sensor status
        sensors: {
          accelerometer: {
            x: device.accelerometerX,
            y: device.accelerometerY,
            z: device.accelerometerZ
          },
          digitalInputs: device.digitalInputs,
          digitalOutputs: device.digitalOutputs,
          analogInputs: device.analogInputs
        }
      };
      
      // Handle different response formats
      switch (format) {
        case 'csv':
          const csvData = convertStatusToCSV([responseData]);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_status.csv"`);
          return res.send(csvData);
          
        case 'xml':
          const xmlData = convertToXML(responseData);
          res.setHeader('Content-Type', 'application/xml');
          return res.send(xmlData);
          
        default:
          return res.json(responseData);
      }
      
    } catch (error) {
      console.error('Error fetching asset status:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch asset status'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/events - Event history with types
router.get('/kagu/asset/:ASSET_ID/events',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('historical'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { limit = 50, offset = 0, eventType, format = 'json' } = req.query;
      
      const orbcommClient = getOrbcommClient();
      
      // Get historical data for the asset
      const historicalData = orbcommClient.getHistoricalDataForAsset(ASSET_ID);
      
      if (!historicalData || historicalData.length === 0) {
        return res.status(404).json({
          error: 'No event history found',
          message: 'No historical events available for this asset'
        });
      }
      
      // Filter by event type if specified
      let filteredEvents = historicalData;
      if (eventType) {
        filteredEvents = historicalData.filter(event => 
          event.eventTypes?.includes(eventType) || 
          event.primaryEventType === eventType ||
          event.eventClass === eventType
        );
      }
      
      // Apply pagination
      const paginatedEvents = filteredEvents.slice(offset, offset + limit);
      
      // Transform for response
      const events = paginatedEvents.map(event => ({
        messageId: event.messageId,
        assetId: event.assetId,
        deviceId: event.deviceId,
        eventClass: event.eventClass,
        eventTypes: event.eventTypes,
        primaryEventType: event.primaryEventType,
        timestamps: {
          event: event.eventTimestamp,
          device: event.deviceTimestamp,
          received: event.receivedTimestamp
        },
        location: {
          latitude: event.gpsData?.hasGPS ? event.gpsData.latitude : null,
          longitude: event.gpsData?.hasGPS ? event.gpsData.longitude : null
        },
        reeferAlarms: event.reeferData?.alarmCode ? {
          code: event.reeferData.alarmCode,
          status: event.reeferData.alarmStatus
        } : null,
        geofence: event.geofenceData?.hasGeofenceData ? {
          id: event.geofenceData.geofenceId,
          name: event.geofenceData.geofenceName,
          event: event.geofenceData.geofenceEvent
        } : null
      }));
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        events,
        pagination: {
          total: filteredEvents.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + limit < filteredEvents.length
        },
        filter: {
          eventType: eventType || null
        },
        timestamp: new Date().toISOString()
      };
      
      // Handle different response formats
      switch (format) {
        case 'csv':
          const csvData = convertEventsToCSV(events);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_events.csv"`);
          return res.send(csvData);
          
        case 'xml':
          const xmlData = convertToXML(responseData);
          res.setHeader('Content-Type', 'application/xml');
          return res.send(xmlData);
          
        default:
          return res.json(responseData);
      }
      
    } catch (error) {
      console.error('Error fetching asset events:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch asset events'
      });
    }
  }
);

// Health check endpoint
router.get('/health', (req, res) => {
  const orbcommClient = getOrbcommClient();
  const status = orbcommClient.getConnectionStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    orbcomm: {
      connected: status.connected,
      assetsTracked: status.assetsTracked,
      lastHeartbeat: new Date(status.lastHeartbeat).toISOString()
    },
    uptime: process.uptime()
  });
});

// Debug endpoint
router.get('/debug', (req, res) => {
  const orbcommClient = getOrbcommClient();
  const debugInfo = orbcommClient.getDebugInfo();
  
  res.json({
    timestamp: new Date().toISOString(),
    debug: debugInfo
  });
});

// New Database-Powered Endpoints

// GET /api/kagu/asset/{ASSET_ID}/history - Asset history with persistent storage
router.get('/kagu/asset/:ASSET_ID/history',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('historical'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { days = 30, format = 'json' } = req.query;
      
      if (!isDatabaseConnected()) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'Historical data service is currently unavailable'
        });
      }
      
      const dbOps = getDatabaseOperations();
      const historyData = await dbOps.getAssetHistory(ASSET_ID, parseInt(days));
      
      if (!historyData || historyData.length === 0) {
        return res.status(404).json({
          error: 'No history found',
          message: `No historical data found for asset ${ASSET_ID} in the last ${days} days`
        });
      }
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        history: historyData.map(row => ({
          id: row.id,
          sequenceId: row.sequence_id,
          eventType: row.event_type,
          eventTime: row.event_time,
          deviceTime: row.device_time,
          receivedTime: row.received_time,
          location: {
            latitude: row.latitude ? parseFloat(row.latitude) : null,
            longitude: row.longitude ? parseFloat(row.longitude) : null,
            gpsLockState: row.gps_lock_state || null,
            satelliteCount: row.satellite_count || null
          },
          temperature: {
            ambient: row.ambient ? parseFloat(row.ambient) : null,
            setpoint: row.setpoint ? parseFloat(row.setpoint) : null,
            supply1: row.supply1 ? parseFloat(row.supply1) : null,
            return1: row.return1 ? parseFloat(row.return1) : null
          }
        })),
        period: {
          days: parseInt(days),
          from: moment().subtract(days, 'days').toISOString(),
          to: moment().toISOString()
        },
        count: historyData.length,
        timestamp: new Date().toISOString()
      };
      
      if (format === 'csv') {
        const csvData = convertHistoryToCSV(responseData.history);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_history_${days}days.csv"`);
        return res.send(csvData);
      }
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Error fetching asset history:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch asset history'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/track - GPS tracking with date range
router.get('/kagu/asset/:ASSET_ID/track',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('gps'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { from, to, format = 'json' } = req.query;
      
      if (!isDatabaseConnected()) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'Tracking data service is currently unavailable'
        });
      }
      
      const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();
      
      const dbOps = getDatabaseOperations();
      const trackData = await dbOps.getAssetTrack(ASSET_ID, fromDate, toDate);
      
      if (!trackData || trackData.length === 0) {
        return res.status(404).json({
          error: 'No tracking data found',
          message: `No GPS tracking data found for asset ${ASSET_ID} in the specified period`
        });
      }
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        track: trackData.map(row => ({
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          timestamp: row.timestamp,
          gpsLockState: row.gps_lock_state,
          satelliteCount: row.satellite_count,
          eventType: row.event_type
        })),
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        },
        totalPoints: trackData.length,
        timestamp: new Date().toISOString()
      };
      
      if (format === 'csv') {
        const csvData = convertTrackToCSV(responseData.track);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_track.csv"`);
        return res.send(csvData);
      }
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Error fetching asset track:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch asset tracking data'
      });
    }
  }
);

// GET /api/kagu/asset/{ASSET_ID}/temperatures/trend - Temperature trend analysis
router.get('/kagu/asset/:ASSET_ID/temperatures/trend',
  validateClientAccessMiddleware,
  validateAssetAccess,
  checkPermissions('reefer'),
  async (req, res) => {
    try {
      const { ASSET_ID } = req.params;
      const { days = 7, format = 'json' } = req.query;
      
      if (!isDatabaseConnected()) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'Temperature data service is currently unavailable'
        });
      }
      
      const dbOps = getDatabaseOperations();
      const tempData = await dbOps.getTemperatureTrend(ASSET_ID, parseInt(days));
      
      if (!tempData || tempData.length === 0) {
        return res.status(404).json({
          error: 'No temperature data found',
          message: `No temperature data found for asset ${ASSET_ID} in the last ${days} days`
        });
      }
      
      // Calculate trend statistics
      const ambientTemps = tempData.filter(row => row.ambient !== null).map(row => parseFloat(row.ambient));
      const setpointTemps = tempData.filter(row => row.setpoint !== null).map(row => parseFloat(row.setpoint));
      
      const stats = {
        ambient: ambientTemps.length > 0 ? {
          min: Math.min(...ambientTemps),
          max: Math.max(...ambientTemps),
          avg: ambientTemps.reduce((a, b) => a + b, 0) / ambientTemps.length,
          count: ambientTemps.length
        } : null,
        setpoint: setpointTemps.length > 0 ? {
          min: Math.min(...setpointTemps),
          max: Math.max(...setpointTemps),
          avg: setpointTemps.reduce((a, b) => a + b, 0) / setpointTemps.length,
          count: setpointTemps.length
        } : null
      };
      
      const responseData = {
        clientId: 'KAGU',
        assetId: ASSET_ID,
        temperatures: tempData.map(row => ({
          ambient: row.ambient ? parseFloat(row.ambient) : null,
          setpoint: row.setpoint ? parseFloat(row.setpoint) : null,
          supply1: row.supply1 ? parseFloat(row.supply1) : null,
          return1: row.return1 ? parseFloat(row.return1) : null,
          timestamp: row.timestamp
        })),
        statistics: stats,
        period: {
          days: parseInt(days),
          from: moment().subtract(days, 'days').toISOString(),
          to: moment().toISOString()
        },
        totalReadings: tempData.length,
        timestamp: new Date().toISOString()
      };
      
      if (format === 'csv') {
        const csvData = convertTemperaturesToCSV(responseData.temperatures);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="asset_${ASSET_ID}_temperatures_${days}days.csv"`);
        return res.send(csvData);
      }
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Error fetching temperature trend:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch temperature trend data'
      });
    }
  }
);

// GET /api/kagu/reports/daily - Daily reports
router.get('/kagu/reports/daily',
  validateClientAccessMiddleware,
  checkPermissions('reports'),
  async (req, res) => {
    try {
      const { date, format = 'json' } = req.query;
      const reportDate = date ? new Date(date) : new Date();
      const dateStr = reportDate.toISOString().split('T')[0];
      
      if (!isDatabaseConnected()) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'Reports service is currently unavailable'
        });
      }
      
      const dbOps = getDatabaseOperations();
      const reportData = await dbOps.getDailyReport(dateStr);
      
      const responseData = {
        clientId: 'KAGU',
        reportDate: dateStr,
        summary: {
          totalEvents: reportData.totalEvents[0]?.count || 0,
          uniqueAssets: reportData.uniqueAssets[0]?.count || 0,
          avgAmbientTemp: reportData.avgTemperature[0]?.avg_ambient ? 
            parseFloat(reportData.avgTemperature[0].avg_ambient).toFixed(2) : null,
          avgSetpointTemp: reportData.avgTemperature[0]?.avg_setpoint ? 
            parseFloat(reportData.avgTemperature[0].avg_setpoint).toFixed(2) : null
        },
        eventsByType: reportData.eventsByType?.map(row => ({
          eventType: row.event_type,
          count: row.count
        })) || [],
        timestamp: new Date().toISOString()
      };
      
      if (format === 'csv') {
        const csvData = convertReportToCSV(responseData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="daily_report_${dateStr}.csv"`);
        return res.send(csvData);
      }
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Error generating daily report:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate daily report'
      });
    }
  }
);

// GET /api/kagu/analytics/summary - Analytics summary
router.get('/kagu/analytics/summary',
  validateClientAccessMiddleware,
  checkPermissions('reports'),
  async (req, res) => {
    try {
      const { format = 'json' } = req.query;
      
      if (!isDatabaseConnected()) {
        return res.status(503).json({
          error: 'Database unavailable',
          message: 'Analytics service is currently unavailable'
        });
      }
      
      const dbOps = getDatabaseOperations();
      const analyticsData = await dbOps.getAnalyticsSummary();
      
      const responseData = {
        clientId: 'KAGU',
        summary: {
          totalEvents: analyticsData.totalEvents[0]?.count || 0,
          totalAssets: analyticsData.totalAssets[0]?.count || 0,
          eventsLast24h: analyticsData.eventsLast24h[0]?.count || 0,
          assetsWithGPS: analyticsData.assetsWithGPS[0]?.count || 0,
          assetsWithTemperature: analyticsData.assetsWithTemperature[0]?.count || 0
        },
        temperatureStats: {
          minTemp: analyticsData.temperatureStats[0]?.min_temp || null,
          maxTemp: analyticsData.temperatureStats[0]?.max_temp || null,
          avgTemp: analyticsData.temperatureStats[0]?.avg_temp ? 
            parseFloat(analyticsData.temperatureStats[0].avg_temp).toFixed(2) : null,
          readingsCount: analyticsData.temperatureStats[0]?.readings_count || 0
        },
        recentLocations: analyticsData.recentLocations?.map(row => ({
          assetId: row.asset_id,
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          timestamp: row.timestamp
        })) || [],
        timestamp: new Date().toISOString()
      };
      
      if (format === 'csv') {
        const csvData = convertAnalyticsToCSV(responseData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics_summary.csv"`);
        return res.send(csvData);
      }
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Error generating analytics summary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate analytics summary'
      });
    }
  }
);

// Updated health check to include database status
router.get('/health', async (req, res) => {
  const orbcommClient = getOrbcommClient();
  const status = orbcommClient.getConnectionStatus();
  
  let databaseStatus = { connected: false };
  try {
    if (isDatabaseConnected()) {
      const { getHealthStatus } = require('../database');
      databaseStatus = await getHealthStatus();
    }
  } catch (error) {
    databaseStatus = { connected: false, error: error.message };
  }
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    orbcomm: {
      connected: status.connected,
      assetsTracked: status.assetsTracked,
      lastHeartbeat: new Date(status.lastHeartbeat).toISOString()
    },
    database: databaseStatus,
    uptime: process.uptime()
  });
});

// Helper functions
function generateMockHistoricalData(deviceId, currentData, startDate, endDate, messageType, limit, offset) {
  // This is a mock implementation
  // In production, you would query actual historical data from a database
  const now = new Date();
  const start = startDate || new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
  const end = endDate || now;
  
  const data = [];
  const totalRecords = 500; // Mock total
  
  for (let i = offset; i < Math.min(offset + limit, totalRecords); i++) {
    const timestamp = new Date(start.getTime() + (i * (end.getTime() - start.getTime()) / totalRecords));
    
    if (!messageType || currentData.messageType === messageType) {
      data.push({
        messageId: `msg_${deviceId}_${i}`,
        deviceId,
        messageType: currentData.messageType,
        timestamp: timestamp.toISOString(),
        data: {
          ...currentData.data,
          // Add some variation to mock historical data
          ...(currentData.data.latitude && {
            latitude: currentData.data.latitude + (Math.random() - 0.5) * 0.001,
            longitude: currentData.data.longitude + (Math.random() - 0.5) * 0.001
          }),
          ...(currentData.data.battery && {
            battery: Math.max(0, Math.min(100, currentData.data.battery + (Math.random() - 0.5) * 10))
          })
        }
      });
    }
  }
  
  return {
    data,
    total: totalRecords
  };
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = ['assetId', 'deviceId', 'status', 'eventTimestamp', 'deviceTimestamp', 'receivedTimestamp', 'eventToServerLag', 'offlineDuration', 'eventClass', 'latitude', 'longitude', 'extPower', 'batteryVoltage', 'ambientTemp', 'setTemp', 'supplyTemp1', 'returnTemp1'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = '';
      switch (header) {
        case 'assetId': value = row.assetId || ''; break;
        case 'deviceId': value = row.deviceId || ''; break;
        case 'status': value = row.status || ''; break;
        case 'eventTimestamp': value = row.eventTimestamp || row.timestamp || ''; break;
        case 'deviceTimestamp': value = row.deviceTimestamp || ''; break;
        case 'receivedTimestamp': value = row.receivedTimestamp || row.receivedAt || ''; break;
        case 'eventToServerLag': value = row.timeLags?.eventToReceived || ''; break;
        case 'offlineDuration': value = row.offlineDuration || ''; break;
        case 'eventClass': value = row.eventClass || ''; break;
        case 'latitude': value = row.gpsData?.latitude || row.gps?.latitude || ''; break;
        case 'longitude': value = row.gpsData?.longitude || row.gps?.longitude || ''; break;
        case 'extPower': value = row.deviceData?.extPower !== undefined ? row.deviceData.extPower : ''; break;
        case 'batteryVoltage': value = row.deviceData?.batteryVoltage || ''; break;
        case 'ambientTemp': value = row.reeferData?.ambientTemp || row.reefer?.ambientTemp || ''; break;
        case 'setTemp': value = row.reeferData?.setTemp || row.reefer?.setTemp || ''; break;
        case 'supplyTemp1': value = row.reeferData?.supplyTemp1 || row.reefer?.supplyTemp1 || ''; break;
        case 'returnTemp1': value = row.reeferData?.returnTemp1 || row.reefer?.returnTemp1 || ''; break;
      }
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function convertDetailedToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = ['assetId', 'deviceId', 'status', 'primaryEventType', 'eventTimestamp', 'deviceTimestamp', 'rssi', 'extPowerVoltage', 'batteryVoltage', 'deviceTemp', 'gpsLockState', 'satelliteCount', 'latitude', 'longitude', 'ambientTemp', 'setTemp', 'supplyTemp1', 'returnTemp1', 'firmwareVersion'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = '';
      switch (header) {
        case 'assetId': value = row.assetId || ''; break;
        case 'deviceId': value = row.deviceId || ''; break;
        case 'status': value = row.status || ''; break;
        case 'primaryEventType': value = row.primaryEventType || ''; break;
        case 'eventTimestamp': value = row.timestamps?.event || ''; break;
        case 'deviceTimestamp': value = row.timestamps?.device || ''; break;
        case 'rssi': value = row.deviceData?.rssi || ''; break;
        case 'extPowerVoltage': value = row.deviceData?.extPowerVoltage || ''; break;
        case 'batteryVoltage': value = row.deviceData?.batteryVoltage || ''; break;
        case 'deviceTemp': value = row.deviceData?.deviceTemp || ''; break;
        case 'gpsLockState': value = row.gpsData?.lockState || ''; break;
        case 'satelliteCount': value = row.gpsData?.satelliteCount || ''; break;
        case 'latitude': value = row.gpsData?.latitude || ''; break;
        case 'longitude': value = row.gpsData?.longitude || ''; break;
        case 'ambientTemp': value = row.reeferData?.ambientTemp || ''; break;
        case 'setTemp': value = row.reeferData?.setTemp || ''; break;
        case 'supplyTemp1': value = row.reeferData?.supplyTemp1 || ''; break;
        case 'returnTemp1': value = row.reeferData?.returnTemp1 || ''; break;
        case 'firmwareVersion': value = row.deviceData?.firmwareVersion || ''; break;
      }
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function convertStatusToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = ['assetId', 'deviceId', 'status', 'lastUpdate', 'extPowerConnected', 'extPowerVoltage', 'batteryVoltage', 'deviceTemp', 'rssi', 'mcc', 'mnc', 'gpsLockState', 'satelliteCount', 'firmwareVersion'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = '';
      switch (header) {
        case 'assetId': value = row.assetId || ''; break;
        case 'deviceId': value = row.deviceId || ''; break;
        case 'status': value = row.status || ''; break;
        case 'lastUpdate': value = row.lastUpdate || ''; break;
        case 'extPowerConnected': value = row.power?.external?.connected || ''; break;
        case 'extPowerVoltage': value = row.power?.external?.voltage || ''; break;
        case 'batteryVoltage': value = row.power?.battery?.voltage || ''; break;
        case 'deviceTemp': value = row.deviceHealth?.temperature || ''; break;
        case 'rssi': value = row.communication?.rssi || ''; break;
        case 'mcc': value = row.communication?.network?.mcc || ''; break;
        case 'mnc': value = row.communication?.network?.mnc || ''; break;
        case 'gpsLockState': value = row.gpsStatus?.lockState || ''; break;
        case 'satelliteCount': value = row.gpsStatus?.satelliteCount || ''; break;
        case 'firmwareVersion': value = row.deviceHealth?.firmware || ''; break;
      }
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function convertEventsToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = ['messageId', 'assetId', 'deviceId', 'eventClass', 'primaryEventType', 'eventTimestamp', 'deviceTimestamp', 'latitude', 'longitude', 'reeferAlarmCode', 'geofenceEvent'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = '';
      switch (header) {
        case 'messageId': value = row.messageId || ''; break;
        case 'assetId': value = row.assetId || ''; break;
        case 'deviceId': value = row.deviceId || ''; break;
        case 'eventClass': value = row.eventClass || ''; break;
        case 'primaryEventType': value = row.primaryEventType || ''; break;
        case 'eventTimestamp': value = row.timestamps?.event || ''; break;
        case 'deviceTimestamp': value = row.timestamps?.device || ''; break;
        case 'latitude': value = row.location?.latitude || ''; break;
        case 'longitude': value = row.location?.longitude || ''; break;
        case 'reeferAlarmCode': value = row.reeferAlarms?.code || ''; break;
        case 'geofenceEvent': value = row.geofence?.event || ''; break;
      }
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function convertToXML(data) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<response>\n';
  
  function objectToXML(obj, indent = '  ') {
    let result = '';
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        result += `${indent}<${key}>\n`;
        result += objectToXML(value, indent + '  ');
        result += `${indent}</${key}>\n`;
      } else if (Array.isArray(value)) {
        value.forEach(item => {
          result += `${indent}<${key}>\n`;
          if (typeof item === 'object') {
            result += objectToXML(item, indent + '  ');
          } else {
            result += `${indent}  ${item}\n`;
          }
          result += `${indent}</${key}>\n`;
        });
      } else {
        result += `${indent}<${key}>${value}</${key}>\n`;
      }
    }
    return result;
  }
  
  xml += objectToXML(data);
  xml += '</response>';
  
  return xml;
}

// New CSV conversion helpers for database endpoints
function convertHistoryToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = ['id', 'sequenceId', 'eventType', 'eventTime', 'deviceTime', 'receivedTime', 'latitude', 'longitude', 'gpsLockState', 'satelliteCount', 'ambient', 'setpoint', 'supply1', 'return1'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = '';
      switch (header) {
        case 'id': value = row.id || ''; break;
        case 'sequenceId': value = row.sequenceId || ''; break;
        case 'eventType': value = row.eventType || ''; break;
        case 'eventTime': value = row.eventTime || ''; break;
        case 'deviceTime': value = row.deviceTime || ''; break;
        case 'receivedTime': value = row.receivedTime || ''; break;
        case 'latitude': value = row.location?.latitude || ''; break;
        case 'longitude': value = row.location?.longitude || ''; break;
        case 'gpsLockState': value = row.location?.gpsLockState || ''; break;
        case 'satelliteCount': value = row.location?.satelliteCount || ''; break;
        case 'ambient': value = row.temperature?.ambient || ''; break;
        case 'setpoint': value = row.temperature?.setpoint || ''; break;
        case 'supply1': value = row.temperature?.supply1 || ''; break;
        case 'return1': value = row.temperature?.return1 || ''; break;
      }
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function convertTrackToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = ['latitude', 'longitude', 'timestamp', 'gpsLockState', 'satelliteCount', 'eventType'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function convertTemperaturesToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = ['ambient', 'setpoint', 'supply1', 'return1', 'timestamp'];
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function convertReportToCSV(data) {
  if (!data) return '';
  
  let csv = 'Report Type,Value\n';
  csv += `"Report Date","${data.reportDate}"\n`;
  csv += `"Total Events","${data.summary.totalEvents}"\n`;
  csv += `"Unique Assets","${data.summary.uniqueAssets}"\n`;
  csv += `"Average Ambient Temperature","${data.summary.avgAmbientTemp || 'N/A'}"\n`;
  csv += `"Average Setpoint Temperature","${data.summary.avgSetpointTemp || 'N/A'}"\n\n`;
  
  if (data.eventsByType && data.eventsByType.length > 0) {
    csv += 'Event Type,Count\n';
    data.eventsByType.forEach(event => {
      csv += `"${event.eventType}","${event.count}"\n`;
    });
  }
  
  return csv;
}

function convertAnalyticsToCSV(data) {
  if (!data) return '';
  
  let csv = 'Metric,Value\n';
  csv += `"Total Events","${data.summary.totalEvents}"\n`;
  csv += `"Total Assets","${data.summary.totalAssets}"\n`;
  csv += `"Events Last 24h","${data.summary.eventsLast24h}"\n`;
  csv += `"Assets with GPS","${data.summary.assetsWithGPS}"\n`;
  csv += `"Assets with Temperature","${data.summary.assetsWithTemperature}"\n`;
  csv += `"Min Temperature","${data.temperatureStats.minTemp || 'N/A'}"\n`;
  csv += `"Max Temperature","${data.temperatureStats.maxTemp || 'N/A'}"\n`;
  csv += `"Average Temperature","${data.temperatureStats.avgTemp || 'N/A'}"\n`;
  csv += `"Temperature Readings Count","${data.temperatureStats.readingsCount}"\n\n`;
  
  if (data.recentLocations && data.recentLocations.length > 0) {
    csv += 'Asset ID,Latitude,Longitude,Timestamp\n';
    data.recentLocations.forEach(location => {
      csv += `"${location.assetId}","${location.latitude}","${location.longitude}","${location.timestamp}"\n`;
    });
  }
  
  return csv;
}

module.exports = router;