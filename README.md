# ORBCOMM API Server - KAGU Client

A specialized ORBCOMM satellite tracking API server that connects to the ORBCOMM WebSocket, filters KAGU, SZLU, and TRIU assets, and provides REST API and real-time WebSocket endpoints for asset tracking.

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0 or higher
- npm or yarn package manager

### Installation

1. **Clone/download the project files**
2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   The `.env` file should contain:

   ```

## 🆕 Enhanced Features

### Asset Status Tracking
- **Online/Offline Detection**: Assets not seen for 6+ hours are marked offline
- **Historical Data Storage**: Last known locations stored for offline assets
- **Status Fields**: All API responses include `status`, `lastKnownLocation`, `offlineDuration`
- **Expected Asset Coverage**: All 10 KAGU assets tracked even when offline

### Complete ORBCOMM Data Extraction
- **Event Types**: Extract specific event types from MessageData.Events array (ScheduledReport, Alarm, Geofence, etc.)
- **Complete Sensor Data**: Signal strength (RSSI), GPS quality, network info, device temperature, all reefer sensors
- **Enhanced Timestamps**: Event, device, and received times with lag calculations
- **Delayed Report Handling**: Proper handling of delayed reports with original timestamps

### 🖥️ **Real-time Dashboard**
- **Professional Fleet Monitoring Interface** at http://localhost:3000/dashboard
- **Interactive Map**: Live device markers on Indonesia map with real-time updates
- **Device Status Grid**: 10 KAGU asset cards with color-coded status
- **Fleet Overview**: Total/online/offline counters with live stats
- **Temperature Monitoring**: Real-time 4-sensor temperature display
- **WebSocket Updates**: Live data refresh every 30 seconds
- **Mobile Responsive**: Works on desktop, tablet, and mobile
- **Dark Theme**: Toggle between light and dark modes
- **Professional UI**: Bootstrap 5 design ready for client presentation

### New API Endpoints
- `/api/kagu/assets/all` - All 10 assets (online + offline)
- `/api/kagu/assets/offline` - Only offline assets with last known data
- `/api/kagu/asset/{id}/detailed` - Complete sensor data with all ORBCOMM fields
- `/api/kagu/asset/{id}/status` - Device status (power, signal, GPS quality)
- `/api/kagu/asset/{id}/events` - Event history with type filtering
- Enhanced individual endpoints support offline asset data

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Run comprehensive tests**
   ```bash
   npm test
   ```

## 📋 Verification Checklist

After starting the server, you should see these confirmations:

### ✅ Server Startup
```
🚀 ORBCOMM API Server Starting...
🌐 Server: http://0.0.0.0:3000
📚 Documentation: http://0.0.0.0:3000/docs
🔧 Environment: development
📊 Log Level: debug
```

### ✅ ORBCOMM Connection
```
🔗 Initializing ORBCOMM WebSocket connection...
📡 URL: wss://wamc.wamcentral.net:44355/cdh
🔐 Protocol: cdh.orbcomm.com
🎫 Auth: Basic Y2RoUFRTT0c6Y0Q...
✅ ORBCOMM WebSocket Connected - Ready to receive data
📤 GetEvents request sent - Requesting up to 5000 events (including historical)
```

### ✅ Data Reception & Filtering
```
📦 Received 5000 events from ORBCOMM
🎯 Expected 10 KAGU assets, found 10 unique assets from 5000 total events
   📋 Found assets: TRIU8784787, KAGU3330950, KAGU3330820, SZLU9721417, SZLU3961914, KAGU3331180, KAGU3331339, KAGU3331283, KAGU7771228, KAGU3331302
🎯 KAGU asset processed: KAGU3331339
   📍 Asset: KAGU3331339
   🔧 Device: JJJC125090470
   📊 Event: ScheduledReport [ScheduledReport, TemperatureSetpointChanged]
   📈 Status: online
   🕐 Event Time: 2025-07-18T02:27:27Z
   🌍 GPS: -6.82037, 113.116607 (GPS_LOCK, 8 satellites, 145m alt)
   📡 Signal: -67dBm, Network: 510-11
   🔋 Power: External Connected (12.5V), Battery 3.9V
   🌡️  Device: 35.2°C
   🌡️  Reefer: Ambient 30.5°C | Set 3°C | Supply 2.81°C | Return 5.88°C
   ⚙️  Reefer Status: Mode: AUTO, Compressor: ON
   ⚙️  Firmware: v2.1.5
   ⏱️  Event→Server Lag: 3.0s
```

## 🧪 Testing

### Comprehensive Test Suite

Run the full test suite to verify all functionality:

```bash
npm test
```

**Expected Output:**
```
🚀 ORBCOMM API Server - Local Testing Suite
============================================================

📋 Test 1: Server Health Check
----------------------------------------
✅ Server is running
   Status: ok
   ORBCOMM Connected: true
   Assets Tracked: 10
✅ ORBCOMM WebSocket Connected

🔌 Test 2: API Endpoints
----------------------------------------
   Testing: List KAGU Assets
   ✅ List KAGU Assets - Success
      Assets found: 10
      Total assets: 10
   ✅ All expected KAGU assets found!
      Found asset IDs: TRIU8784787, KAGU3330950, KAGU3330820, SZLU9721417, SZLU3961914, KAGU3331180, KAGU3331339, KAGU3331283, KAGU7771228, KAGU3331302
      Asset 1: KAGU3331339 (GPS: true, Reefer: true)
      Asset 2: SZLU9721417 (GPS: false, Reefer: false)
      Asset 3: TRIU8784787 (GPS: true, Reefer: false)

🔗 Test 3: WebSocket Connection
----------------------------------------
   Connecting to: ws://localhost:3000/ws/kagu?apiKey=api_key_kagu_12345
   ✅ WebSocket Connected
   ✅ Connection Confirmed
      Client ID: KAGU
      Asset Patterns: KAGU*, SZLU*, TRIU*
      Total Assets: 10
   ✅ Real-time Asset Data Received
      Asset ID: KAGU3331339
      GPS: -6.82037, 113.116607

📊 Test Summary
============================================================
🎉 ORBCOMM API Server is working correctly!
```

### Individual Test Commands

```bash
# Test API endpoints only
npm run test:api

# Test WebSocket functionality only  
npm run test:websocket

# Run server with full debug output
npm run debug

# Run server with ORBCOMM-specific debug
npm run debug:orbcomm

# Watch server logs in real-time
npm run logs
```

## 🔌 API Endpoints

### Authentication
All API endpoints require the KAGU API key:
```bash
X-API-Key: api_key_kagu_12345
```

### Available Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `GET /health` | Server and ORBCOMM status | `curl http://localhost:3000/health` |
| `GET /dashboard` | **Real-time Fleet Dashboard** | Open http://localhost:3000/dashboard |
| `GET /api/kagu/assets` | List online KAGU assets | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/assets` |
| `GET /api/kagu/assets/all` | List all KAGU assets (online + offline) | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/assets/all` |
| `GET /api/kagu/assets/offline` | List only offline KAGU assets | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/assets/offline` |
| `GET /api/kagu/asset/{ASSET_ID}/latest` | Latest asset data (includes offline) | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/asset/KAGU3331339/latest` |
| `GET /api/kagu/asset/{ASSET_ID}/detailed` | Complete sensor data with all ORBCOMM fields | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/asset/KAGU3331339/detailed` |
| `GET /api/kagu/asset/{ASSET_ID}/status` | Device status (power, signal, GPS quality) | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/asset/KAGU3331339/status` |
| `GET /api/kagu/asset/{ASSET_ID}/events` | Event history with types and filtering | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/asset/KAGU3331339/events` |
| `GET /api/kagu/asset/{ASSET_ID}/gps` | GPS coordinates (includes last known) | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/asset/KAGU3331339/gps` |
| `GET /api/kagu/asset/{ASSET_ID}/reefer` | Temperature data only | `curl -H "X-API-Key: api_key_kagu_12345" http://localhost:3000/api/kagu/asset/KAGU3331339/reefer` |

### Export Formats
Add `?format=csv` or `?format=xml` to any endpoint for different output formats:
```bash
curl -H "X-API-Key: api_key_kagu_12345" \
     "http://localhost:3000/api/kagu/asset/KAGU3331339/latest?format=csv" \
     -o asset_data.csv
```

## 🔗 WebSocket Real-time Updates

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/kagu?apiKey=api_key_kagu_12345');

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  if (data.type === 'connection') {
    console.log('Connected! Tracking', data.totalAssets, 'assets');
  } else if (data.assetId) {
    console.log('Asset update:', data.assetId);
    if (data.gpsData.hasGPS) {
      console.log('GPS:', data.gpsData.latitude, data.gpsData.longitude);
    }
    if (data.reeferData.hasReeferData) {
      console.log('Temperature:', data.reeferData.ambientTemp, '°C');
    }
  }
};
```

### Message Types

**Connection Confirmation:**
```json
{
  "type": "connection",
  "clientId": "KAGU",
  "assetPatterns": ["KAGU*", "SLTU*"],
  "totalAssets": 10
}
```

**Asset Data Update:**
```json
{
  "clientId": "KAGU",
  "assetId": "KAGU3331339",
  "deviceId": "JJJC125090470",
  "timestamp": "2025-07-18T02:27:27Z",
  "gpsData": {
    "latitude": -6.82037,
    "longitude": 113.116607,
    "hasGPS": true
  },
  "reeferData": {
    "ambientTemp": 30.5,
    "supplyTemp1": 2.81,
    "setTemp": 3,
    "hasReeferData": true
  }
}
```

## 🛠️ Development

### Project Structure
```
orbcomm-api-server/
├── server.js              # Main application entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment configuration
├── config/
│   └── clients.js         # KAGU client configuration
├── middleware/
│   └── auth.js            # API key authentication & validation
├── routes/
│   └── api.js             # REST API endpoints
├── utils/
│   └── orbcomm.js         # ORBCOMM WebSocket client
├── test/
│   └── local-test.js      # Comprehensive test suite
├── docs/
│   └── api.md             # API documentation
└── logs/                  # Application logs
```

### Configuration

**KAGU Client Configuration** (`config/clients.js`):
```javascript
'KAGU': {
  name: 'KAGU Client',
  apiKey: 'api_key_kagu_12345',
  assetPatterns: ['KAGU*', 'SZLU*', 'TRIU*'],
  specificAssets: [
    'TRIU8784787', 'KAGU3330950', 'KAGU3330820', 'SZLU9721417', 'SZLU3961914',
    'KAGU3331180', 'KAGU3331339', 'KAGU3331283', 'KAGU7771228', 'KAGU3331302'
  ],
  totalAssets: 10, // 7x KAGU + 2x SZLU + 1x TRIU assets
  permissions: {
    realTime: true,
    gps: true,
    reefer: true,
    export: true
  }
}
```

### Logging Levels

**Production** (`LOG_LEVEL=info`):
- Basic server operations
- ORBCOMM connection status
- API request summaries
- Error messages

**Development** (`LOG_LEVEL=debug`):
- Detailed console output with emojis
- Individual asset processing logs
- WebSocket message details
- Request/response timing
- GPS and reefer data details

### Custom Scripts

```bash
# Development with auto-reload
npm run dev

# Production start
npm start

# Full debug output (all modules)
npm run debug

# ORBCOMM-specific debug only
npm run debug:orbcomm

# Watch logs in real-time
npm run logs

# PM2 process management
npm run pm2:start
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

## 🐛 Troubleshooting

### Common Issues

**1. ORBCOMM Connection Failed**
```
❌ Error: WebSocket connection failed
```
**Solution:**
- Check internet connection
- Verify ORBCOMM credentials in `.env`
- Check firewall/proxy settings
- Ensure WebSocket URL is accessible

**2. No KAGU Assets Found**
```
Assets found: 0
Total assets: 0
Expected: 10 assets
```
**Possible causes:**
- ORBCOMM hasn't sent data yet (wait 1-2 minutes)
- No KAGU/SZLU/TRIU assets in current data stream
- Asset ID patterns don't match actual data
- **Check `/api/kagu/assets/all` endpoint** - shows all 10 expected assets even when offline
- **Use offline tracking** - assets may be offline but still tracked with last known data
- Check specific asset IDs: TRIU8784787, KAGU3330950, KAGU3330820, SZLU9721417, SZLU3961914, KAGU3331180, KAGU3331339, KAGU3331283, KAGU7771228, KAGU3331302

**3. API Key Authentication Failed**
```
❌ Invalid API key or client access denied
```
**Solution:**
- Verify API key: `api_key_kagu_12345`
- Check `X-API-Key` header format
- Ensure client configuration matches

**4. WebSocket Connection Rejected**
```
❌ WebSocket rejected: No API key provided
```
**Solution:**
- Add API key to WebSocket URL: `?apiKey=api_key_kagu_12345`
- Check WebSocket URL format
- Verify client has real-time permissions

### Debug Commands

**Check server health:**
```bash
curl http://localhost:3000/health
```

**Test API with verbose output:**
```bash
curl -v -H "X-API-Key: api_key_kagu_12345" \
     http://localhost:3000/api/kagu/assets
```

**Monitor ORBCOMM connection:**
```bash
# Watch logs for ORBCOMM messages
tail -f logs/combined.log | grep ORBCOMM

# Check connection status every 30 seconds (debug mode)
LOG_LEVEL=debug npm run dev
```

**Test WebSocket connection:**
```bash
# Use websocat tool if available
websocat ws://localhost:3000/ws/kagu?apiKey=api_key_kagu_12345

# Or use the test suite
npm run test:websocket
```

### Performance Monitoring

**Check memory usage:**
```bash
curl http://localhost:3000/health | jq '.memory'
```

**Monitor asset processing:**
```bash
# Enable debug logging to see asset filtering
LOG_LEVEL=debug npm run dev
```

**WebSocket connection monitoring:**
```bash
# Check connection metrics
curl http://localhost:3000/health | jq '.orbcomm'
```

## 📚 Documentation

- **Full API Documentation:** http://localhost:3000/docs/api.md
- **Interactive API Explorer:** http://localhost:3000/docs
- **Health Monitoring:** http://localhost:3000/health

## 🚀 Production Deployment

### PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start with production configuration
NODE_ENV=production pm2 start ecosystem.config.js

# Monitor processes
pm2 monit

# View logs
pm2 logs orbcomm-api-server

# Restart gracefully
pm2 restart orbcomm-api-server

# Stop all processes
pm2 stop all
```

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ORBCOMM_WS_URL=wss://wamc.wamcentral.net:44355/cdh
ORBCOMM_PROTOCOL=cdh.orbcomm.com
ORBCOMM_AUTH=Basic Y2RoUFRTT0c6Y0QjMyNQdEAhU0BvZw==
ALLOWED_ORIGINS=https://yourdomain.com
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Run the test suite: `npm test`
3. Enable debug logging: `LOG_LEVEL=debug npm run dev`
4. Check server logs: `npm run logs`

## 📄 License

MIT License
