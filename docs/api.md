# ORBCOMM API Server Documentation - KAGU Client

## Overview

The ORBCOMM API Server provides a specialized REST API and WebSocket interface for accessing KAGU ORBCOMM satellite tracking data. The server filters and provides access to assets with IDs starting with 'KAGU' or 'SLTU' patterns, serving 10 total assets from the ORBCOMM data stream.

## Base URL

```
http://localhost:3000
```

## Authentication

All API endpoints require authentication using an API key. Include your API key in one of the following ways:

### Header Authentication (Recommended)
```http
X-API-Key: your_api_key_here
```

### Query Parameter Authentication
```http
GET /api/client/client1/devices?apiKey=your_api_key_here
```

## KAGU Client Configuration

The server is configured specifically for KAGU client with the following configuration:

| Client ID | API Key | Asset Patterns | Total Assets | Rate Limit | Permissions |
|-----------|---------|----------------|--------------|------------|-------------|
| KAGU | api_key_kagu_12345 | KAGU*, SZLU*, TRIU* | 10 assets | 2000 req/15min | All (realTime, historical, export, gps, reefer) |

**KAGU Client Specific Assets:**
- TRIU8784787
- KAGU3330950  
- KAGU3330820
- SZLU9721417
- SZLU3961914
- KAGU3331180
- KAGU3331339
- KAGU3331283
- KAGU7771228
- KAGU3331302

## Data Structure

The server connects to ORBCOMM WebSocket and sends this GetEvents message:
```json
{
  "GetEvents": {
    "EventType": "all",
    "EventPartition": 1,
    "PrecedingEventID": "",
    "FollowingEventID": null,
    "MaxEventCount": 1000
  }
}
```

ORBCOMM responds with events in this format:
```json
{
  "Sequence": 1000,
  "Event": {
    "EventClass": "DeviceMessage",
    "MessageData": {
      "MsgID": "024cd433-fa04-448d-80de-24e6c22fe355",
      "EventDtm": "2025-07-18T02:27:27Z"
    },
    "DeviceData": {
      "DeviceID": "JJJC125090470",
      "DeviceDataDtm": "2025-07-18T02:27:25Z",
      "LastAssetID": "KAGU3331339",
      "GPSLatitude": -6.82037,
      "GPSLongitude": 113.116607,
      "ExtPower": true,
      "BatteryVoltage": 3.9
    },
    "ReeferData": {
      "AssetID": "KAGU3331339",
      "TAmb": 30.5,
      "TSet": 3,
      "TSup1": 2.81,
      "TRtn1": 5.88
    }
  }
}
```

## REST API Endpoints

### 1. List KAGU Assets

Get a list of all KAGU assets (KAGU*, SZLU*, and TRIU* patterns).

```http
GET /api/kagu/assets
```

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| limit | integer | Number of assets to return (1-1000) | 50 |
| offset | integer | Number of assets to skip | 0 |

#### Example Request

```bash
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/assets?limit=10&offset=0"
```

#### Example Response

```json
{
  "clientId": "KAGU",
  "assets": [
    {
      "assetId": "KAGU3331339",
      "deviceId": "JJJC125090470",
      "lastSeen": "2025-07-18T02:27:27Z",
      "eventClass": "DeviceMessage",
      "hasGPS": true,
      "hasReeferData": true,
      "extPower": true,
      "batteryVoltage": 3.9
    },
    {
      "assetId": "SZLU9721417",
      "deviceId": "JJJC125090471",
      "lastSeen": "2025-07-18T02:25:00Z",
      "eventClass": "DeviceMessage",
      "hasGPS": false,
      "hasReeferData": false,
      "extPower": false,
      "batteryVoltage": 2.1
    },
    {
      "assetId": "TRIU8784787",
      "deviceId": "JJJC125090472",
      "lastSeen": "2025-07-18T02:24:00Z",
      "eventClass": "DeviceMessage",
      "hasGPS": true,
      "hasReeferData": false,
      "extPower": true,
      "batteryVoltage": 3.2
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  },
  "timestamp": "2025-07-18T02:30:00.000Z"
}
```

### 2. Get Latest Asset Data

Retrieve the most recent data from a specific KAGU asset.

```http
GET /api/kagu/asset/{ASSET_ID}/latest
```

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| format | string | Response format: json, csv, xml | json |

#### Example Request

```bash
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/asset/KAGU3331339/latest"
```

#### Example Response

```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "deviceId": "JJJC125090470",
  "status": "online",
  "timestamp": "2025-07-18T02:27:27Z",
  "eventTimestamp": "2025-07-18T02:27:27Z",
  "deviceTimestamp": "2025-07-18T02:27:25Z",
  "receivedTimestamp": "2025-07-18T02:27:30Z",
  "lastUpdate": "2025-07-18T02:27:27Z",
  "offlineDuration": null,
  "receivedAt": "2025-07-18T02:27:30Z",
  "eventClass": "DeviceMessage",
  "timeLags": {
    "eventToReceived": "3.0s",
    "deviceToReceived": "5.0s",
    "eventToDevice": "2.0s"
  },
  "gpsData": {
    "latitude": -6.82037,
    "longitude": 113.116607,
    "hasGPS": true
  },
  "deviceData": {
    "extPower": true,
    "batteryVoltage": 3.9,
    "lastAssetId": "KAGU3331339"
  },
  "reeferData": {
    "assetId": "KAGU3331339",
    "ambientTemp": 30.5,
    "supplyTemp1": 2.81,
    "setTemp": 3,
    "hasReeferData": true
  },
  "lastKnownLocation": {
    "latitude": -6.82037,
    "longitude": 113.116607,
    "timestamp": "2025-07-18T02:27:27Z"
  }
}
```

### 3. Get GPS Data

Retrieve GPS coordinates for a specific KAGU asset.

```http
GET /api/kagu/asset/{ASSET_ID}/gps
```

#### Example Request

```bash
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/asset/KAGU3331339/gps"
```

#### Example Response

```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "deviceId": "JJJC125090470",
  "status": "online",
  "timestamp": "2025-07-18T02:27:27Z",
  "lastUpdate": "2025-07-18T02:27:27Z",
  "offlineDuration": null,
  "gps": {
    "latitude": -6.82037,
    "longitude": 113.116607,
    "hasGPS": true
  }
}
```

### 4. Get Reefer Data

Retrieve temperature and reefer data for a specific KAGU asset.

```http
GET /api/kagu/asset/{ASSET_ID}/reefer
```

#### Example Request

```bash
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/asset/KAGU3331339/reefer"
```

#### Example Response

```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "deviceId": "JJJC125090470",
  "status": "online",
  "timestamp": "2025-07-18T02:27:27Z",
  "lastUpdate": "2025-07-18T02:27:27Z",
  "offlineDuration": null,
  "reefer": {
    "assetId": "KAGU3331339",
    "ambientTemp": 30.5,
    "setTemp": 3,
    "supplyTemp1": 2.81,
    "returnTemp1": 5.88,
    "hasReeferData": true
  }
}
```

### 5. Get Detailed Asset Data

Retrieve complete sensor data and all ORBCOMM fields for a specific asset.

```http
GET /api/kagu/asset/{ASSET_ID}/detailed
```

#### Example Response

```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "deviceId": "JJJC125090470",
  "status": "online",
  "eventClass": "DeviceMessage",
  "eventTypes": ["ScheduledReport", "TemperatureSetpointChanged"],
  "primaryEventType": "ScheduledReport",
  "timestamps": {
    "event": "2025-07-18T02:27:27Z",
    "device": "2025-07-18T02:27:25Z",
    "received": "2025-07-18T02:27:30Z",
    "lastUpdate": "2025-07-18T02:27:27Z"
  },
  "gpsData": {
    "latitude": -6.82037,
    "longitude": 113.116607,
    "hasGPS": true,
    "lockState": "GPS_LOCK",
    "satelliteCount": 8,
    "altitude": 145,
    "speed": 0,
    "heading": 180
  },
  "deviceData": {
    "extPower": true,
    "extPowerVoltage": 12.5,
    "batteryVoltage": 3.9,
    "deviceTemp": 35.2,
    "rssi": -67,
    "mcc": "510",
    "mnc": "11",
    "firmwareVersion": "v2.1.5",
    "hardwareVersion": "v1.0.3"
  },
  "reeferData": {
    "ambientTemp": 30.5,
    "setTemp": 3,
    "supplyTemp1": 2.81,
    "returnTemp1": 5.88,
    "operatingMode": "AUTO",
    "compressorStatus": "ON",
    "hasReeferData": true
  }
}
```

### 6. Get Device Status

Retrieve device status information including power, signal, and GPS quality.

```http
GET /api/kagu/asset/{ASSET_ID}/status
```

#### Example Response

```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "status": "online",
  "power": {
    "external": {
      "connected": true,
      "voltage": 12.5
    },
    "battery": {
      "voltage": 3.9
    }
  },
  "communication": {
    "rssi": -67,
    "network": {
      "mcc": "510",
      "mnc": "11"
    }
  },
  "gpsStatus": {
    "hasGPS": true,
    "lockState": "GPS_LOCK",
    "satelliteCount": 8
  },
  "deviceHealth": {
    "temperature": 35.2,
    "firmware": "v2.1.5"
  }
}
```

### 7. Get Event History

Retrieve historical events with type filtering.

```http
GET /api/kagu/asset/{ASSET_ID}/events
```

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| limit | integer | Number of events to return | 50 |
| offset | integer | Number of events to skip | 0 |
| eventType | string | Filter by event type | none |

#### Example Response

```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "events": [
    {
      "messageId": "024cd433-fa04-448d-80de-24e6c22fe355",
      "eventClass": "DeviceMessage",
      "primaryEventType": "ScheduledReport",
      "timestamps": {
        "event": "2025-07-18T02:27:27Z",
        "device": "2025-07-18T02:27:25Z",
        "received": "2025-07-18T02:27:30Z"
      },
      "location": {
        "latitude": -6.82037,
        "longitude": 113.116607
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### 8. Health Check

Check the server and ORBCOMM connection status.

```http
GET /health
```

#### Example Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "orbcomm": {
    "connected": true,
    "devicesTracked": 15,
    "reconnectAttempts": 0,
    "lastHeartbeat": "2024-01-15T10:34:30.000Z"
  },
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 29360128,
    "heapUsed": 20971520,
    "external": 1048576
  },
  "pid": 12345
}
```

## WebSocket Real-Time Updates

Connect to receive real-time updates for KAGU assets.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/kagu?apiKey=api_key_kagu_12345');
```

### Message Types

#### Connection Confirmation
```json
{
  "type": "connection",
  "clientId": "KAGU",
  "status": "connected",
  "timestamp": "2025-07-18T02:35:00.000Z",
  "assetPatterns": ["KAGU*", "SZLU*", "TRIU*"],
  "totalAssets": 10,
  "permissions": {
    "realTime": true,
    "historical": true,
    "export": true,
    "gps": true,
    "reefer": true
  }
}
```

#### Asset Data Updates
```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "deviceId": "JJJC125090470",
  "timestamp": "2025-07-18T02:35:00.000Z",
  "eventClass": "DeviceMessage",
  "gpsData": {
    "latitude": -6.82037,
    "longitude": 113.116607,
    "hasGPS": true
  },
  "deviceData": {
    "extPower": true,
    "batteryVoltage": 3.9,
    "lastAssetId": "KAGU3331339"
  },
  "reeferData": {
    "assetId": "KAGU3331339",
    "ambientTemp": 30.5,
    "supplyTemp1": 2.81,
    "setTemp": 3,
    "hasReeferData": true
  },
  "receivedAt": "2025-07-18T02:35:05.000Z"
}
```

#### Heartbeat
```json
{
  "type": "heartbeat",
  "timestamp": "2025-07-18T02:35:00.000Z",
  "orbcommStatus": {
    "connected": true,
    "assetsTracked": 10,
    "reconnectAttempts": 0,
    "lastHeartbeat": 1721268900000
  }
}
```

### JavaScript WebSocket Example

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/kagu?apiKey=api_key_kagu_12345');

ws.onopen = function(event) {
  console.log('Connected to KAGU ORBCOMM API WebSocket');
};

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'connection':
      console.log('Connection confirmed:', message);
      console.log('Asset patterns:', message.assetPatterns);
      break;
    case 'heartbeat':
      console.log('Heartbeat received, assets tracked:', message.orbcommStatus.assetsTracked);
      break;
    default:
      // Asset data update
      console.log('Asset update:', message.assetId);
      if (message.gpsData.hasGPS) {
        console.log('GPS:', message.gpsData.latitude, message.gpsData.longitude);
      }
      if (message.reeferData.hasReeferData) {
        console.log('Reefer temps:', message.reeferData.ambientTemp, message.reeferData.supplyTemp1);
      }
      break;
  }
};

ws.onclose = function(event) {
  console.log('WebSocket closed:', event.code, event.reason);
};

ws.onerror = function(error) {
  console.error('WebSocket error:', error);
};
```

## Data Formats

### Export Formats

#### CSV Format
Request with `format=csv` parameter to receive CSV data:

```csv
"assetId","deviceId","status","eventTimestamp","deviceTimestamp","receivedTimestamp","eventToServerLag","offlineDuration","eventClass","latitude","longitude","extPower","batteryVoltage","ambientTemp","setTemp","supplyTemp1","returnTemp1"
"KAGU3331339","JJJC125090470","online","2025-07-18T02:27:27Z","2025-07-18T02:27:25Z","2025-07-18T02:27:30Z","3.0s","","DeviceMessage","-6.82037","113.116607","true","3.9","30.5","3","2.81","5.88"
```

#### XML Format
Request with `format=xml` parameter to receive XML data:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <clientId>KAGU</clientId>
  <assetId>KAGU3331339</assetId>
  <deviceId>JJJC125090470</deviceId>
  <timestamp>2025-07-18T02:27:27Z</timestamp>
  <gpsData>
    <latitude>-6.82037</latitude>
    <longitude>113.116607</longitude>
    <hasGPS>true</hasGPS>
  </gpsData>
  <reeferData>
    <ambientTemp>30.5</ambientTemp>
    <supplyTemp1>2.81</supplyTemp1>
    <setTemp>3</setTemp>
  </reeferData>
</response>
```

## Data Types

### GPS Data
Contains GPS location information:
- latitude, longitude (decimal degrees)
- hasGPS flag indicating GPS availability

### Timestamp Information
The API provides comprehensive timestamp tracking:
- **eventTimestamp** (EventDtm) - When the event occurred according to ORBCOMM
- **deviceTimestamp** (DeviceDataDtm) - When the device recorded the data
- **receivedTimestamp** - When the server received the data
- **timeLags** - Calculated time differences between timestamps
  - eventToReceived - Time from event to server reception
  - deviceToReceived - Time from device to server reception  
  - eventToDevice - Time difference between event and device timestamps
- **timestamp** - Maintained for backward compatibility (same as eventTimestamp)

### Device Data
Contains device power and hardware information:
- extPower (boolean) - external power connection status
- batteryVoltage (float) - battery voltage level
- lastAssetId - most recent asset associated with device

### Reefer Data
Contains 4 key temperature monitoring readings:
- ambientTemp (TAmb) - ambient temperature around the container
- setTemp (TSet) - target/set point temperature
- supplyTemp1 (TSup1) - supply air temperature sensor 1
- returnTemp1 (TRtn1) - return air temperature sensor 1
- hasReeferData flag indicating reefer data availability

### Event Classes
- DeviceMessage - Standard device communication event
- Other event types as defined by ORBCOMM protocol

## Error Handling

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Human readable error description",
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Access denied to resource |
| 404 | Not Found - Resource does not exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Rate Limiting

Each client has individual rate limits. When exceeded, you'll receive:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests from this client. Try again in 15 minutes."
}
```

## Installation and Setup

### Prerequisites

- Node.js 16.0 or higher
- npm or yarn package manager

### Installation

1. Clone or download the server files
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. For development with auto-reload:
   ```bash
   npm run dev
   ```

5. For production with PM2:
   ```bash
   npm run pm2:start
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
ALLOWED_ORIGINS=https://yourdomain.com,https://anotherdomain.com
```

### PM2 Production Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem configuration
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart orbcomm-api-server
```

## API Client Examples

### Python Example

```python
import requests
import websocket
import json

# REST API Example - Get KAGU assets
headers = {'X-API-Key': 'api_key_kagu_12345'}
response = requests.get(
    'http://localhost:3000/api/kagu/assets',
    headers=headers
)
print(response.json())

# Get specific asset data
response = requests.get(
    'http://localhost:3000/api/kagu/asset/KAGU3331339/latest',
    headers=headers
)
print(response.json())

# WebSocket Example
def on_message(ws, message):
    data = json.loads(message)
    if data.get('type') == 'connection':
        print(f"Connected to KAGU client, tracking {data['totalAssets']} assets")
    elif 'assetId' in data:
        print(f"Asset update: {data['assetId']}")
        if data['gpsData']['hasGPS']:
            print(f"GPS: {data['gpsData']['latitude']}, {data['gpsData']['longitude']}")
        if data['reeferData']['hasReeferData']:
            print(f"Temps: Amb={data['reeferData']['ambientTemp']}, Sup={data['reeferData']['supplyTemp1']}")

def on_error(ws, error):
    print(f"Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("Connection closed")

ws = websocket.WebSocketApp(
    "ws://localhost:3000/ws/kagu?apiKey=api_key_kagu_12345",
    on_message=on_message,
    on_error=on_error,
    on_close=on_close
)
ws.run_forever()
```

### cURL Examples

```bash
# Get KAGU assets
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/assets"

# Get latest asset data
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/asset/KAGU3331339/latest"

# Get GPS data
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/asset/KAGU3331339/gps"

# Get reefer data as CSV
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/asset/KAGU3331339/reefer?format=csv" \
     -o kagu_reefer.csv

# Health check
curl "http://localhost:3000/health"
```

## Support and Contributing

For issues, questions, or contributions, please refer to the project repository or contact the development team.

## License

This project is licensed under the MIT License.