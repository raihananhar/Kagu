const WebSocket = require('ws');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/orbcomm.log' })
  ]
});

class OrbcommClient {
  constructor() {
    this.url = process.env.ORBCOMM_WS_URL || 'wss://wamc.wamcentral.net:44355/cdh';
    this.protocol = process.env.ORBCOMM_PROTOCOL || 'cdh.orbcomm.com';
    this.auth = process.env.ORBCOMM_AUTH || 'Basic Y2RoUFRTT0c6Y0QjMyNQdEAhU0BvZw==';
    this.ws = null;
    this.isConnected = false;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.messageHandlers = new Set();
    this.deviceData = new Map(); // Current/latest asset data
    this.historicalData = new Map(); // Historical data for offline assets
    this.assetStatus = new Map(); // Asset online/offline status tracking
    this.lastHeartbeat = Date.now();
    this.heartbeatInterval = 30000;
    this.heartbeatTimer = null;
    this.eventCount = 0;
    this.kaguAssetCount = 0;
    this.lastEventTime = null;
    this.lastEventId = '';
    this.maxEventCount = 5000; // Increased for historical data
    this.offlineThreshold = 15 * 60 * 1000; // 15 minutes in milliseconds
  }

  connect() {
    try {
      logger.info('🔗 Attempting to connect to ORBCOMM WebSocket');
      logger.info(`📡 URL: ${this.url}`);
      logger.info(`🔐 Protocol: ${this.protocol}`);
      logger.info(`🎫 Auth: ${this.auth.substring(0, 20)}...`);
      
      this.ws = new WebSocket(this.url, this.protocol, {
        headers: {
          'Authorization': this.auth,
          'User-Agent': 'ORBCOMM-API-Server/1.0'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.eventCount = 0;
        this.kaguAssetCount = 0;
        logger.info('✅ Connected to ORBCOMM WebSocket successfully');
        console.log('✅ ORBCOMM WebSocket Connected - Ready to receive data');
        this.startHeartbeat();
        this.sendSubscriptionRequest();
      });

      this.ws.on('message', (data) => {
        this.lastHeartbeat = Date.now();
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.stopHeartbeat();
        logger.warn(`ORBCOMM WebSocket closed: ${code} - ${reason}`);
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('ORBCOMM WebSocket error:', error);
        this.isConnected = false;
        this.stopHeartbeat();
      });

    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
      logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached. Stopping reconnection.');
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastHeartbeat > this.heartbeatInterval * 2) {
        logger.warn('Heartbeat timeout detected, reconnecting...');
        this.ws.close();
      } else if (this.isConnected) {
        this.sendPing();
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  sendPing() {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.ping();
    }
  }

  sendSubscriptionRequest() {
    const getEventsMessage = {
      "GetEvents": {
        "EventType": "all",
        "EventPartition": 1,
        "PrecedingEventID": this.lastEventId,
        "FollowingEventID": null,
        "MaxEventCount": this.maxEventCount
      }
    };

    this.sendMessage(getEventsMessage);
    logger.info('📤 Sent GetEvents request to ORBCOMM');
    console.log(`📤 GetEvents request sent - Requesting up to ${this.maxEventCount} events (including historical)`);
    if (this.lastEventId) {
      console.log(`   📅 Starting from event ID: ${this.lastEventId}`);
    }
    logger.debug('GetEvents message:', JSON.stringify(getEventsMessage, null, 2));
  }

  requestHistoricalData(precedingEventId = '') {
    const historicalRequest = {
      "GetEvents": {
        "EventType": "all",
        "EventPartition": 1,
        "PrecedingEventID": precedingEventId,
        "FollowingEventID": null,
        "MaxEventCount": this.maxEventCount
      }
    };

    this.sendMessage(historicalRequest);
    logger.info('📜 Sent historical data request to ORBCOMM');
    console.log(`📜 Historical data request sent - MaxEventCount: ${this.maxEventCount}`);
    if (precedingEventId) {
      console.log(`   📅 Starting from preceding event ID: ${precedingEventId}`);
    }
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.lastEventTime = new Date().toISOString();
      
      logger.debug('📨 Received message from ORBCOMM');

      // Handle different ORBCOMM response types
      if (message.Events && Array.isArray(message.Events)) {
        // Multiple events response
        console.log(`📦 Received ${message.Events.length} events from ORBCOMM`);
        logger.info(`📦 Processing ${message.Events.length} events`);
        
        let kaguEvents = 0;
        const processedAssetIds = new Set();
        
        message.Events.forEach(event => {
          const processed = this.processEvent(event);
          if (processed) {
            kaguEvents++;
            processedAssetIds.add(processed.assetId);
          }
        });
        
        // Get expected asset information
        const { getExpectedAssetsForClient } = require('../config/clients');
        const expectedInfo = getExpectedAssetsForClient('KAGU');
        
        console.log(`🎯 Expected ${expectedInfo.expectedCount} KAGU assets, found ${processedAssetIds.size} unique assets from ${message.Events.length} total events`);
        logger.info(`🎯 KAGU filtering: Expected=${expectedInfo.expectedCount}, Found=${processedAssetIds.size}, Events=${kaguEvents}/${message.Events.length}`);
        
        // Log which specific assets were found if debug enabled
        if (process.env.LOG_LEVEL === 'debug' && processedAssetIds.size > 0) {
          console.log(`   📋 Found assets: ${Array.from(processedAssetIds).join(', ')}`);
          
          // Check for missing expected assets
          const foundAssets = Array.from(processedAssetIds);
          const missingAssets = expectedInfo.specificAssets.filter(asset => !foundAssets.includes(asset));
          if (missingAssets.length > 0) {
            console.log(`   ⚠️  Missing assets: ${missingAssets.join(', ')}`);
          }
        }
        
      } else if (message.Event) {
        // Single event response
        this.eventCount++;
        console.log(`📨 Received event #${this.eventCount}`);
        const processed = this.processEvent(message);
        if (processed) {
          console.log(`🎯 KAGU asset processed: ${processed.assetId}`);
        }
      } else if (message.Sequence) {
        // Single event with sequence
        this.eventCount++;
        console.log(`📨 Received sequenced event #${message.Sequence}`);
        const processed = this.processEvent(message);
        if (processed) {
          console.log(`🎯 KAGU asset processed: ${processed.assetId}`);
        }
      } else {
        logger.debug('❓ Unhandled message type:', Object.keys(message));
        console.log(`❓ Unknown message type: ${Object.keys(message).join(', ')}`);
      }
    } catch (error) {
      logger.error('❌ Error parsing ORBCOMM message:', error);
      console.log(`❌ Message parsing error: ${error.message}`);
    }
  }

  processEvent(eventData) {
    try {
      const transformedEvent = this.transformOrbcommEvent(eventData);
      
      if (transformedEvent) {
        // Check if this is a KAGU client asset using the updated validation
        const { validateClientAccess } = require('../config/clients');
        const isKaguAsset = transformedEvent.assetId && validateClientAccess('KAGU', transformedEvent.assetId);
        
        if (isKaguAsset) {
          this.kaguAssetCount++;
          logger.debug(`🎯 Processing KAGU asset: ${transformedEvent.assetId}`);
          
          const now = new Date();
          const eventTime = new Date(transformedEvent.timestamp);
          
          // Store/update asset status tracking - use original event time for delayed reports
          const statusUpdateTime = new Date(transformedEvent.eventTimestamp);
          this.updateAssetStatus(transformedEvent.assetId, statusUpdateTime, transformedEvent);
          
          // Calculate time lags
          const eventToReceived = this.calculateTimeLag(transformedEvent.eventTimestamp, transformedEvent.receivedTimestamp);
          const deviceToReceived = transformedEvent.deviceTimestamp ? 
            this.calculateTimeLag(transformedEvent.deviceTimestamp, transformedEvent.receivedTimestamp) : null;
          const eventToDevice = transformedEvent.deviceTimestamp ? 
            this.calculateTimeLag(transformedEvent.eventTimestamp, transformedEvent.deviceTimestamp) : null;
          
          // Handle delayed reports properly - don't reduce data count
          const isDelayedReport = eventToReceived && this.parseTimeLag(eventToReceived) > 300000; // >5 minutes
          
          // Store latest asset data using AssetID as key
          const enrichedEvent = {
            ...transformedEvent,
            receivedAt: transformedEvent.receivedTimestamp,
            status: this.getAssetStatus(transformedEvent.assetId),
            lastUpdate: transformedEvent.eventTimestamp, // Use original event time
            offlineDuration: this.getOfflineDuration(transformedEvent.assetId),
            isDelayedReport: isDelayedReport,
            timeLags: {
              eventToReceived,
              deviceToReceived,
              eventToDevice
            }
          };
          
          this.deviceData.set(transformedEvent.assetId, enrichedEvent);
          
          // Store historical data for all assets (including delayed reports)
          this.storeHistoricalData(transformedEvent.assetId, enrichedEvent);
          
          // Log delayed report information
          if (isDelayedReport && process.env.LOG_LEVEL === 'debug') {
            console.log(`   ⏰ DELAYED REPORT: Event from ${transformedEvent.eventTimestamp}, received ${eventToReceived} later`);
          }

          // Enhanced logging with complete ORBCOMM data
          if (process.env.LOG_LEVEL === 'debug') {
            console.log(`   📍 Asset: ${transformedEvent.assetId}`);
            console.log(`   🔧 Device: ${transformedEvent.deviceId}`);
            
            // Show primary event type from Events array or fallback to EventClass
            // Parse and display specific event types like ORBCOMM dashboard
            const eventDisplay = this.parseEventDescription(transformedEvent);
            console.log(`   📊 Event: ${eventDisplay}`);
            console.log(`   📈 Status: ${enrichedEvent.status}`);
            
            // Enhanced timestamp logging
            console.log(`   🕐 Event Time: ${transformedEvent.eventTimestamp}`);
            if (transformedEvent.deviceTimestamp) {
              console.log(`   🕑 Device Time: ${transformedEvent.deviceTimestamp}`);
            }
            
            // Enhanced GPS with quality metrics
            if (transformedEvent.gpsData.hasGPS) {
              const gps = transformedEvent.gpsData;
              let gpsInfo = `${gps.latitude}, ${gps.longitude}`;
              
              const gpsDetails = [];
              if (gps.lockState) gpsDetails.push(gps.lockState);
              if (gps.satelliteCount) gpsDetails.push(`${gps.satelliteCount} satellites`);
              if (gps.altitude) gpsDetails.push(`${gps.altitude}m alt`);
              if (gps.speed) gpsDetails.push(`${gps.speed}km/h`);
              
              if (gpsDetails.length > 0) {
                gpsInfo += ` (${gpsDetails.join(', ')})`;
              }
              
              console.log(`   🌍 GPS: ${gpsInfo}`);
            }
            
            // Signal and network information
            const device = transformedEvent.deviceData;
            const signalInfo = [];
            if (device.rssi !== undefined) signalInfo.push(`${device.rssi}dBm`);
            if (device.mcc && device.mnc) signalInfo.push(`Network: ${device.mcc}-${device.mnc}`);
            if (signalInfo.length > 0) {
              console.log(`   📡 Signal: ${signalInfo.join(', ')}`);
            }
            
            // Power status information
            const powerInfo = [];
            if (device.extPower !== undefined) {
              const extPowerStatus = device.extPower ? 'Connected' : 'Disconnected';
              if (device.extPowerVoltage) {
                powerInfo.push(`External ${extPowerStatus} (${device.extPowerVoltage}V)`);
              } else {
                powerInfo.push(`External ${extPowerStatus}`);
              }
            }
            if (device.batteryVoltage) powerInfo.push(`Battery ${device.batteryVoltage}V`);
            if (powerInfo.length > 0) {
              console.log(`   🔋 Power: ${powerInfo.join(', ')}`);
            }
            
            // Device temperature
            if (device.deviceTemp !== undefined) {
              console.log(`   🌡️  Device: ${device.deviceTemp}°C`);
            }
            
            // Enhanced reefer temperature logging
            if (transformedEvent.reeferData.hasReeferData) {
              const reefer = transformedEvent.reeferData;
              const temps = [];
              
              if (reefer.ambientTemp !== undefined) temps.push(`Ambient ${reefer.ambientTemp}°C`);
              if (reefer.setTemp !== undefined) temps.push(`Set ${reefer.setTemp}°C`);
              if (reefer.supplyTemp1 !== undefined) temps.push(`Supply ${reefer.supplyTemp1}°C`);
              if (reefer.returnTemp1 !== undefined) temps.push(`Return ${reefer.returnTemp1}°C`);
              
              console.log(`   🌡️  Reefer: ${temps.join(' | ')}`);
              
              // Show reefer status and alarms if available
              if (reefer.alarmCode || reefer.operatingMode) {
                const statusInfo = [];
                if (reefer.operatingMode) statusInfo.push(`Mode: ${reefer.operatingMode}`);
                if (reefer.alarmCode) statusInfo.push(`Alarm: ${reefer.alarmCode}`);
                if (reefer.compressorStatus) statusInfo.push(`Compressor: ${reefer.compressorStatus}`);
                
                if (statusInfo.length > 0) {
                  console.log(`   ⚙️  Reefer Status: ${statusInfo.join(', ')}`);
                }
              }
            }
            
            // Firmware version
            if (device.firmwareVersion) {
              console.log(`   ⚙️  Firmware: ${device.firmwareVersion}`);
            }
            
            // Geofence information
            if (transformedEvent.geofenceData.hasGeofenceData) {
              const geo = transformedEvent.geofenceData;
              console.log(`   🗺️ Geofence: ${geo.geofenceName || geo.geofenceId} (${geo.geofenceEvent})`);
            }
            
            // Time lag information (moved to end for better readability)
            if (enrichedEvent.timeLags.eventToReceived) {
              console.log(`   ⏱️  Event→Server Lag: ${enrichedEvent.timeLags.eventToReceived}`);
            }
          }

          // Store event data to database
          this.storeEventToDatabase(enrichedEvent);

          // Notify all message handlers
          this.messageHandlers.forEach(handler => {
            try {
              handler(enrichedEvent);
            } catch (error) {
              logger.error('Error in message handler:', error);
            }
          });
          
          return enrichedEvent;
        }
      }
      return null;
    } catch (error) {
      logger.error('❌ Error processing event:', error);
      return null;
    }
  }

  updateAssetStatus(assetId, eventTime, eventData) {
    const now = new Date();
    const eventAge = now - eventTime; // Time since the event actually occurred
    
    // Update asset status tracking
    const currentStatus = this.assetStatus.get(assetId) || {
      firstSeen: eventTime,
      lastSeen: eventTime,
      lastLocation: null,
      status: 'unknown',
      eventCount: 0,
      lastEventReceived: now
    };
    
    // Only update lastSeen if this event is newer (handle delayed reports)
    if (!currentStatus.lastSeen || eventTime > new Date(currentStatus.lastSeen)) {
      currentStatus.lastSeen = eventTime;
    }
    
    // Always update when we last received an event
    currentStatus.lastEventReceived = now;
    currentStatus.eventCount++;
    
    // Store last known location if GPS available (only if newer)
    if (eventData.gpsData?.hasGPS) {
      const newLocation = {
        latitude: eventData.gpsData.latitude,
        longitude: eventData.gpsData.longitude,
        timestamp: eventTime.toISOString()
      };
      
      // Only update if this location is newer than current
      if (!currentStatus.lastLocation || eventTime > new Date(currentStatus.lastLocation.timestamp)) {
        currentStatus.lastLocation = newLocation;
      }
    }
    
    // Determine online/offline status based on ACTUAL event age (not receive time)
    if (eventAge <= this.offlineThreshold) {
      currentStatus.status = 'online';
    } else {
      currentStatus.status = 'offline';
    }
    
    // Special handling for delayed reports
    const isDelayedReport = (now - eventTime) > 300000; // >5 minutes
    if (isDelayedReport) {
      currentStatus.hasDelayedReports = true;
      currentStatus.lastDelayedReportReceived = now;
    }
    
    this.assetStatus.set(assetId, currentStatus);
  }

  storeHistoricalData(assetId, eventData) {
    if (!this.historicalData.has(assetId)) {
      this.historicalData.set(assetId, []);
    }
    
    const history = this.historicalData.get(assetId);
    
    // Add event to history (keep last 100 events per asset)
    history.unshift({
      ...eventData,
      storedAt: new Date().toISOString()
    });
    
    // Limit history size
    if (history.length > 100) {
      history.splice(100);
    }
    
    this.historicalData.set(assetId, history);
  }

  async storeEventToDatabase(eventData) {
    try {
      const { isConnected: isDatabaseConnected, getDatabaseOperations } = require('../database');
      
      if (!isDatabaseConnected()) {
        // Database not available, skip storage but don't error
        return;
      }
      
      const dbOps = getDatabaseOperations();
      await dbOps.storeEvent(eventData);
      
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug(`💾 Stored event to database: ${eventData.assetId}`);
      }
    } catch (error) {
      // Don't let database errors break ORBCOMM message processing
      logger.error('Database storage error (continuing):', error);
    }
  }

  getAssetStatus(assetId) {
    const status = this.assetStatus.get(assetId);
    if (!status) return 'unknown';
    
    const now = new Date();
    const lastSeen = new Date(status.lastSeen);
    const timeDiff = now - lastSeen;
    
    return timeDiff <= this.offlineThreshold ? 'online' : 'offline';
  }

  getOfflineDuration(assetId) {
    const status = this.assetStatus.get(assetId);
    if (!status || status.status === 'online') return null;
    
    const now = new Date();
    const lastSeen = new Date(status.lastSeen);
    const diffMs = now - lastSeen;
    
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} minutes ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} hours ago`;
    return `${Math.floor(diffMs / 86400000)} days ago`;
  }

  calculateTimeLag(timestamp1, timestamp2) {
    if (!timestamp1 || !timestamp2) return null;
    
    const time1 = new Date(timestamp1);
    const time2 = new Date(timestamp2);
    const diffMs = Math.abs(time2 - time1);
    
    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
    return `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`;
  }

  parseTimeLag(lagString) {
    if (!lagString) return 0;
    
    // Convert lag string back to milliseconds
    if (lagString.includes('ms')) {
      return parseInt(lagString.replace('ms', ''));
    }
    if (lagString.includes('s') && !lagString.includes('m')) {
      return parseFloat(lagString.replace('s', '')) * 1000;
    }
    if (lagString.includes('m') && lagString.includes('s')) {
      const parts = lagString.split(' ');
      const minutes = parseInt(parts[0].replace('m', ''));
      const seconds = parseInt(parts[1].replace('s', ''));
      return (minutes * 60 + seconds) * 1000;
    }
    if (lagString.includes('h')) {
      const parts = lagString.split(' ');
      const hours = parseInt(parts[0].replace('h', ''));
      const minutes = parts[1] ? parseInt(parts[1].replace('m', '')) : 0;
      return (hours * 3600 + minutes * 60) * 1000;
    }
    return 0;
  }

  transformOrbcommEvent(eventData) {
    try {
      const event = eventData.Event;
      if (!event) {
        return null;
      }

      const deviceData = event.DeviceData || {};
      const reeferData = event.ReeferData || {};
      const messageData = event.MessageData || {};
      const geofenceData = event.GeofenceData || {};
      
      // Extract event types from Events array
      const eventTypes = [];
      if (messageData.Events && Array.isArray(messageData.Events)) {
        messageData.Events.forEach(evt => {
          if (evt.EventType) {
            eventTypes.push(evt.EventType);
          }
        });
      }

      // Use ReeferData.AssetID as primary, fallback to DeviceData.LastAssetID
      const assetId = reeferData.AssetID || deviceData.LastAssetID;
      
      if (!assetId) {
        return null; // Skip events without asset ID
      }

      const eventTimestamp = messageData.EventDtm || new Date().toISOString();
      const deviceTimestamp = deviceData.DeviceDataDtm || null;
      const receivedTimestamp = new Date().toISOString();
      
      const transformed = {
        sequence: eventData.Sequence,
        messageId: messageData.MsgID,
        assetId: assetId,
        deviceId: deviceData.DeviceID,
        eventClass: event.EventClass,
        eventTypes: eventTypes,
        primaryEventType: eventTypes.length > 0 ? eventTypes[0] : event.EventClass,
        eventTimestamp: eventTimestamp,
        deviceTimestamp: deviceTimestamp,
        receivedTimestamp: receivedTimestamp,
        timestamp: eventTimestamp, // Keep for backward compatibility
        
        // Enhanced GPS data with quality metrics
        gpsData: {
          latitude: deviceData.GPSLatitude,
          longitude: deviceData.GPSLongitude,
          hasGPS: !!(deviceData.GPSLatitude && deviceData.GPSLongitude),
          lockState: deviceData.GPSLockState,
          satelliteCount: deviceData.GPSSatelliteCount,
          altitude: deviceData.GPSAltitude,
          speed: deviceData.GPSSpeed,
          heading: deviceData.GPSHeading
        },
        
        // Complete device data with all available fields
        deviceData: {
          extPower: deviceData.ExtPower,
          extPowerVoltage: deviceData.ExtPowerVoltage,
          batteryVoltage: deviceData.BatteryVoltage,
          deviceTemp: deviceData.DeviceTemp,
          rssi: deviceData.RSSI,
          lastAssetId: deviceData.LastAssetID,
          
          // Network information
          mcc: deviceData.MCC,
          mnc: deviceData.MNC,
          lac: deviceData.LAC,
          cellId: deviceData.CellID,
          
          // Firmware and device info
          firmwareVersion: deviceData.VerFW,
          hardwareVersion: deviceData.VerHW,
          deviceModel: deviceData.DeviceModel,
          
          // Additional sensor data
          accelerometerX: deviceData.AccelX,
          accelerometerY: deviceData.AccelY,
          accelerometerZ: deviceData.AccelZ,
          
          // Input/output status
          digitalInputs: deviceData.DigitalInputs,
          digitalOutputs: deviceData.DigitalOutputs,
          analogInputs: deviceData.AnalogInputs
        },
        
        // Complete reefer data with all temperature sensors
        reeferData: {
          assetId: reeferData.AssetID,
          ambientTemp: reeferData.TAmb,
          setTemp: reeferData.TSet,
          supplyTemp1: reeferData.TSup1,
          supplyTemp2: reeferData.TSup2,
          returnTemp1: reeferData.TRtn1,
          returnTemp2: reeferData.TRtn2,
          evaporatorTemp: reeferData.TEvap,
          condenserTemp: reeferData.TCond,
          compressorTemp: reeferData.TComp,
          defrostTemp: reeferData.TDefrost,
          
          // Reefer status and alarms
          alarmCode: reeferData.AlarmCode,
          alarmStatus: reeferData.AlarmStatus,
          operatingMode: reeferData.OperatingMode,
          defrostStatus: reeferData.DefrostStatus,
          compressorStatus: reeferData.CompressorStatus,
          
          // Power and runtime information
          engineHours: reeferData.EngineHours,
          compressorHours: reeferData.CompressorHours,
          powerStatus: reeferData.PowerStatus,
          
          hasReeferData: !!(reeferData.AssetID)
        },
        
        // Geofence information
        geofenceData: {
          geofenceId: geofenceData.GeofenceID,
          geofenceName: geofenceData.GeofenceName,
          geofenceType: geofenceData.GeofenceType,
          geofenceEvent: geofenceData.GeofenceEvent,
          hasGeofenceData: !!(geofenceData.GeofenceID)
        }
      };

      return transformed;
    } catch (error) {
      logger.error('Error transforming ORBCOMM event:', error);
      return null;
    }
  }

  sendMessage(message) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        logger.debug('Sent message to ORBCOMM:', message);
      } catch (error) {
        logger.error('Error sending message to ORBCOMM:', error);
      }
    } else {
      logger.warn('Cannot send message: WebSocket not connected');
    }
  }

  addMessageHandler(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  getAssetData(assetId) {
    return this.deviceData.get(assetId) || null;
  }

  getAllAssetsData() {
    return Array.from(this.deviceData.entries()).map(([assetId, data]) => ({
      assetId,
      ...data
    }));
  }

  getAssetsForClient(clientId) {
    const { filterAssetsForClient } = require('../config/clients');
    const allAssets = this.getAllAssetsData();
    
    // Convert to events format for filtering
    const eventsFormat = allAssets.map(asset => ({
      Event: {
        DeviceData: { LastAssetID: asset.deviceData?.lastAssetId },
        ReeferData: { AssetID: asset.reeferData?.assetId }
      }
    }));
    
    const filteredEvents = filterAssetsForClient(clientId, eventsFormat);
    const filteredAssetIds = new Set(filteredEvents.map(event => 
      event.Event?.ReeferData?.AssetID || event.Event?.DeviceData?.LastAssetID
    ));
    
    return allAssets.filter(asset => filteredAssetIds.has(asset.assetId));
  }

  getAllAssetsForClient(clientId) {
    const { getExpectedAssetsForClient } = require('../config/clients');
    const expectedInfo = getExpectedAssetsForClient(clientId);
    const result = [];
    
    // Get data for all expected assets
    expectedInfo.specificAssets.forEach(assetId => {
      const currentData = this.deviceData.get(assetId);
      const status = this.assetStatus.get(assetId);
      
      if (currentData) {
        // Asset has current data
        result.push({
          ...currentData,
          lastKnownLocation: status?.lastLocation || null
        });
      } else if (status) {
        // Asset is known but no current data - create from historical/status
        result.push({
          assetId: assetId,
          status: this.getAssetStatus(assetId),
          lastUpdate: status.lastSeen?.toISOString() || null,
          offlineDuration: this.getOfflineDuration(assetId),
          lastKnownLocation: status.lastLocation,
          gpsData: { hasGPS: !!status.lastLocation },
          deviceData: { lastAssetId: assetId },
          reeferData: { hasReeferData: false },
          receivedAt: new Date().toISOString()
        });
      } else {
        // Asset never seen - create placeholder
        result.push({
          assetId: assetId,
          status: 'never_seen',
          lastUpdate: null,
          offlineDuration: null,
          lastKnownLocation: null,
          gpsData: { hasGPS: false },
          deviceData: { lastAssetId: assetId },
          reeferData: { hasReeferData: false },
          receivedAt: new Date().toISOString()
        });
      }
    });
    
    return result;
  }

  getOfflineAssetsForClient(clientId) {
    const allAssets = this.getAllAssetsForClient(clientId);
    return allAssets.filter(asset => 
      asset.status === 'offline' || asset.status === 'never_seen'
    );
  }

  getOnlineAssetsForClient(clientId) {
    const allAssets = this.getAllAssetsForClient(clientId);
    return allAssets.filter(asset => asset.status === 'online');
  }

  getHistoricalDataForAsset(assetId) {
    return this.historicalData.get(assetId) || [];
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      assetsTracked: this.deviceData.size,
      totalEventsReceived: this.eventCount,
      kaguEventsProcessed: this.kaguAssetCount,
      lastEventTime: this.lastEventTime
    };
  }

  getDebugInfo() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      deviceDataSize: this.deviceData.size,
      assetStatusSize: this.assetStatus.size,
      historicalDataSize: this.historicalData.size,
      totalEventsReceived: this.eventCount,
      kaguEventsProcessed: this.kaguAssetCount,
      lastEventTime: this.lastEventTime,
      deviceDataKeys: Array.from(this.deviceData.keys()),
      assetStatusKeys: Array.from(this.assetStatus.keys())
    };
  }

  disconnect() {
    logger.info('Disconnecting from ORBCOMM WebSocket');
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.messageHandlers.clear();
  }

  parseEventDescription(event) {
    // Parse specific event types to match ORBCOMM dashboard format
    if (event.eventTypes && event.eventTypes.length > 0) {
      const eventDescriptions = event.eventTypes.map(eventType => {
        switch (eventType) {
          case 'PWR_ON': return 'Power on';
          case 'PWR_OFF': return 'Power off';
          case 'REF_ON': return 'Reefer switched on';
          case 'REF_OFF': return 'Reefer switched off';
          case 'SCHEDULED': return 'Scheduled update';
          case 'REPORTING_DELAY': return 'Reporting delay';
          case 'DELAYED_REPORT': return 'Reporting delay';
          case 'GPS_FIX': return 'GPS fix acquired';
          case 'GPS_LOST': return 'GPS fix lost';
          case 'GEOFENCE_ENTER': return 'Geofence entered';
          case 'GEOFENCE_EXIT': return 'Geofence exited';
          case 'TEMP_ALARM': return 'Temperature alarm';
          case 'DOOR_OPEN': return 'Door opened';
          case 'DOOR_CLOSE': return 'Door closed';
          case 'LOW_BATTERY': return 'Low battery';
          case 'HEARTBEAT': return 'Heartbeat';
          case 'MOTION_START': return 'Motion started';
          case 'MOTION_STOP': return 'Motion stopped';
          default: return eventType;
        }
      });
      
      return eventDescriptions.join(', ');
    }
    
    // Fallback: analyze device data and timing for implicit events
    const descriptions = [];
    
    // Check for reporting delay based on event timing
    const eventTime = new Date(event.eventTimestamp);
    const receiveTime = new Date(event.receivedTimestamp);
    const delay = receiveTime - eventTime; // in milliseconds
    
    // If event is delayed by more than 5 minutes, it's a reporting delay
    if (delay > 5 * 60 * 1000) {
      descriptions.push('Reporting delay');
    }
    
    // Check power status changes
    if (event.deviceData.extPower !== undefined) {
      descriptions.push(event.deviceData.extPower ? 'Power on' : 'Power off');
    }
    
    // Check for reefer status
    if (event.reeferData && (event.reeferData.operatingMode !== undefined || event.reeferData.compressorStatus !== undefined)) {
      descriptions.push('Reefer update');
    }
    
    // If no specific events found, return generic description
    if (descriptions.length === 0) {
      return event.eventClass === 'DeviceMessage' ? 'Scheduled update' : (event.eventClass || 'Device message');
    }
    
    return descriptions.join(', ');
  }
}

// Singleton instance
let orbcommClient = null;

function getOrbcommClient() {
  if (!orbcommClient) {
    orbcommClient = new OrbcommClient();
  }
  return orbcommClient;
}

module.exports = {
  OrbcommClient,
  getOrbcommClient
};