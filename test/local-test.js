const WebSocket = require('ws');
const http = require('http');
const chalk = require('chalk');

console.log(chalk.blue.bold('🚀 ORBCOMM API Server - Local Testing Suite'));
console.log(chalk.gray('=' .repeat(60)));

// Test configuration
const TEST_CONFIG = {
  serverUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000',
  apiKey: 'api_key_kagu_12345',
  testAssetId: 'KAGU3331339',
  expectedAssets: [
    'TRIU8784787',
    'KAGU3330950',
    'KAGU3330820',
    'SZLU9721417',
    'SZLU3961914',
    'KAGU3331180',
    'KAGU3331339',
    'KAGU3331283',
    'KAGU7771228',
    'KAGU3331302'
  ],
  expectedAssetCount: 10
};

let testResults = {
  serverHealth: false,
  orbcommConnection: false,
  apiEndpoints: {},
  websocketConnection: false,
  realTimeUpdates: false,
  filtering: false
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'X-API-Key': TEST_CONFIG.apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const req = http.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Helper function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Server Health Check
async function testServerHealth() {
  console.log(chalk.yellow('\n📋 Test 1: Server Health Check'));
  console.log(chalk.gray('-'.repeat(40)));
  
  try {
    const response = await makeRequest(`${TEST_CONFIG.serverUrl}/health`);
    
    if (response.status === 200) {
      console.log(chalk.green('✅ Server is running'));
      console.log(chalk.blue(`   Status: ${response.data.status}`));
      console.log(chalk.blue(`   Version: ${response.data.version}`));
      console.log(chalk.blue(`   Environment: ${response.data.environment}`));
      console.log(chalk.blue(`   Uptime: ${Math.round(response.data.uptime)}s`));
      
      if (response.data.orbcomm) {
        console.log(chalk.blue(`   ORBCOMM Connected: ${response.data.orbcomm.connected}`));
        console.log(chalk.blue(`   Assets Tracked: ${response.data.orbcomm.assetsTracked}`));
        console.log(chalk.blue(`   Reconnect Attempts: ${response.data.orbcomm.reconnectAttempts}`));
        
        testResults.orbcommConnection = response.data.orbcomm.connected;
        if (response.data.orbcomm.connected) {
          console.log(chalk.green('✅ ORBCOMM WebSocket Connected'));
        } else {
          console.log(chalk.red('❌ ORBCOMM WebSocket Not Connected'));
        }
      }
      
      testResults.serverHealth = true;
      return true;
    } else {
      console.log(chalk.red(`❌ Server health check failed: ${response.status}`));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Server health check error: ${error.message}`));
    return false;
  }
}

// Test 2: API Endpoints
async function testApiEndpoints() {
  console.log(chalk.yellow('\n🔌 Test 2: API Endpoints'));
  console.log(chalk.gray('-'.repeat(40)));
  
  const endpoints = [
    { name: 'List KAGU Assets', path: '/api/kagu/assets' },
    { name: 'Asset Latest Data', path: `/api/kagu/asset/${TEST_CONFIG.testAssetId}/latest` },
    { name: 'Asset GPS Data', path: `/api/kagu/asset/${TEST_CONFIG.testAssetId}/gps` },
    { name: 'Asset Reefer Data', path: `/api/kagu/asset/${TEST_CONFIG.testAssetId}/reefer` }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(chalk.blue(`   Testing: ${endpoint.name}`));
      const response = await makeRequest(`${TEST_CONFIG.serverUrl}${endpoint.path}`);
      
      if (response.status === 200) {
        console.log(chalk.green(`   ✅ ${endpoint.name} - Success`));
        
        if (endpoint.path === '/api/kagu/assets') {
          const foundAssets = response.data.assets?.length || 0;
          const totalAssets = response.data.pagination?.total || 0;
          
          console.log(chalk.blue(`      Assets found: ${foundAssets}`));
          console.log(chalk.blue(`      Total assets: ${totalAssets}`));
          console.log(chalk.blue(`      Expected: ${TEST_CONFIG.expectedAssetCount} assets`));
          
          if (foundAssets === TEST_CONFIG.expectedAssetCount) {
            console.log(chalk.green('   ✅ All expected KAGU assets found!'));
            testResults.filtering = true;
          } else if (foundAssets > 0) {
            console.log(chalk.yellow(`   ⚠️  Found ${foundAssets}/${TEST_CONFIG.expectedAssetCount} expected assets`));
            testResults.filtering = 'partial';
          }
          
          if (response.data.assets && response.data.assets.length > 0) {
            const foundAssetIds = response.data.assets.map(a => a.assetId);
            console.log(chalk.blue(`      Found asset IDs: ${foundAssetIds.join(', ')}`));
            
            // Check which expected assets are missing
            const missingAssets = TEST_CONFIG.expectedAssets.filter(id => !foundAssetIds.includes(id));
            if (missingAssets.length > 0) {
              console.log(chalk.yellow(`      Missing assets: ${missingAssets.join(', ')}`));
            }
            
            // Show first 3 assets with details
            response.data.assets.slice(0, 3).forEach((asset, idx) => {
              console.log(chalk.blue(`      Asset ${idx + 1}: ${asset.assetId} (GPS: ${asset.hasGPS}, Reefer: ${asset.hasReeferData})`));
            });
          }
        }
        
        testResults.apiEndpoints[endpoint.name] = true;
      } else if (response.status === 404) {
        console.log(chalk.yellow(`   ⚠️  ${endpoint.name} - Asset not found (${response.status})`));
        testResults.apiEndpoints[endpoint.name] = 'not_found';
      } else {
        console.log(chalk.red(`   ❌ ${endpoint.name} - Failed (${response.status})`));
        testResults.apiEndpoints[endpoint.name] = false;
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ ${endpoint.name} - Error: ${error.message}`));
      testResults.apiEndpoints[endpoint.name] = false;
    }
    
    await wait(500); // Small delay between requests
  }
}

// Test 3: WebSocket Connection
async function testWebSocketConnection() {
  console.log(chalk.yellow('\n🔗 Test 3: WebSocket Connection'));
  console.log(chalk.gray('-'.repeat(40)));
  
  return new Promise((resolve) => {
    const wsUrl = `${TEST_CONFIG.wsUrl}/ws/kagu?apiKey=${TEST_CONFIG.apiKey}`;
    console.log(chalk.blue(`   Connecting to: ${wsUrl}`));
    
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;
    let connectionConfirmed = false;
    let dataReceived = false;
    
    const timeout = setTimeout(() => {
      console.log(chalk.yellow('   ⚠️  WebSocket test timeout (30s)'));
      ws.close();
      resolve();
    }, 30000);
    
    ws.on('open', () => {
      console.log(chalk.green('   ✅ WebSocket Connected'));
      testResults.websocketConnection = true;
    });
    
    ws.on('message', (data) => {
      messageCount++;
      
      try {
        const message = JSON.parse(data.toString());
        console.log(chalk.blue(`   📨 Message ${messageCount}: ${message.type || 'data'}`));
        
        if (message.type === 'connection') {
          connectionConfirmed = true;
          console.log(chalk.green('   ✅ Connection Confirmed'));
          console.log(chalk.blue(`      Client ID: ${message.clientId}`));
          console.log(chalk.blue(`      Asset Patterns: ${message.assetPatterns?.join(', ')}`));
          console.log(chalk.blue(`      Total Assets: ${message.totalAssets}`));
          console.log(chalk.blue(`      Permissions: ${Object.keys(message.permissions || {}).join(', ')}`));
        } else if (message.type === 'heartbeat') {
          console.log(chalk.blue(`   💓 Heartbeat - Assets Tracked: ${message.orbcommStatus?.assetsTracked || 0}`));
        } else if (message.assetId) {
          dataReceived = true;
          testResults.realTimeUpdates = true;
          console.log(chalk.green('   ✅ Real-time Asset Data Received'));
          console.log(chalk.blue(`      Asset ID: ${message.assetId}`));
          console.log(chalk.blue(`      Device ID: ${message.deviceId}`));
          console.log(chalk.blue(`      Event Class: ${message.eventClass}`));
          console.log(chalk.blue(`      Has GPS: ${message.gpsData?.hasGPS}`));
          console.log(chalk.blue(`      Has Reefer: ${message.reeferData?.hasReeferData}`));
          
          if (message.gpsData?.hasGPS) {
            console.log(chalk.blue(`      GPS: ${message.gpsData.latitude}, ${message.gpsData.longitude}`));
          }
          
          if (message.reeferData?.hasReeferData) {
            console.log(chalk.blue(`      Temps: Amb=${message.reeferData.ambientTemp}°C, Sup=${message.reeferData.supplyTemp1}°C`));
          }
        }
        
        // Close connection after receiving some data or 15 seconds
        if (messageCount >= 5 || (connectionConfirmed && messageCount >= 2)) {
          setTimeout(() => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }, 5000);
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ Error parsing WebSocket message: ${error.message}`));
      }
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(chalk.blue(`   📤 WebSocket Closed: ${code} - ${reason}`));
      
      if (connectionConfirmed) {
        console.log(chalk.green('   ✅ WebSocket Test Completed Successfully'));
      }
      resolve();
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(chalk.red(`   ❌ WebSocket Error: ${error.message}`));
      resolve();
    });
  });
}

// Test 4: Data Format Tests
async function testDataFormats() {
  console.log(chalk.yellow('\n📄 Test 4: Data Format Tests'));
  console.log(chalk.gray('-'.repeat(40)));
  
  const formats = ['json', 'csv', 'xml'];
  
  for (const format of formats) {
    try {
      console.log(chalk.blue(`   Testing ${format.toUpperCase()} format`));
      const response = await makeRequest(`${TEST_CONFIG.serverUrl}/api/kagu/asset/${TEST_CONFIG.testAssetId}/latest?format=${format}`);
      
      if (response.status === 200) {
        console.log(chalk.green(`   ✅ ${format.toUpperCase()} format working`));
        
        if (format === 'json') {
          console.log(chalk.blue(`      Response keys: ${Object.keys(response.data).join(', ')}`));
        } else {
          console.log(chalk.blue(`      Response length: ${response.data.length} characters`));
        }
      } else if (response.status === 404) {
        console.log(chalk.yellow(`   ⚠️  ${format.toUpperCase()} format - Asset not found`));
      } else {
        console.log(chalk.red(`   ❌ ${format.toUpperCase()} format failed: ${response.status}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ ${format.toUpperCase()} format error: ${error.message}`));
    }
    
    await wait(300);
  }
}

// Print Test Summary
function printTestSummary() {
  console.log(chalk.yellow('\n📊 Test Summary'));
  console.log(chalk.gray('=' .repeat(60)));
  
  console.log(chalk.blue('🏥 Server Health:'));
  console.log(`   Server Running: ${testResults.serverHealth ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  console.log(`   ORBCOMM Connection: ${testResults.orbcommConnection ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  
  console.log(chalk.blue('\n🔌 API Endpoints:'));
  Object.entries(testResults.apiEndpoints).forEach(([name, result]) => {
    const status = result === true ? chalk.green('✅ PASS') : 
                   result === 'not_found' ? chalk.yellow('⚠️  NO DATA') : 
                   chalk.red('❌ FAIL');
    console.log(`   ${name}: ${status}`);
  });
  
  console.log(chalk.blue('\n🔗 Real-time Features:'));
  console.log(`   WebSocket Connection: ${testResults.websocketConnection ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  console.log(`   Real-time Updates: ${testResults.realTimeUpdates ? chalk.green('✅ PASS') : chalk.yellow('⚠️  NO DATA')}`);
  
  // Handle filtering results
  let filteringStatus;
  if (testResults.filtering === true) {
    filteringStatus = chalk.green('✅ PASS - All 10 assets found');
  } else if (testResults.filtering === 'partial') {
    filteringStatus = chalk.yellow('⚠️  PARTIAL - Some assets missing');
  } else {
    filteringStatus = chalk.red('❌ FAIL - No assets found');
  }
  console.log(`   KAGU Asset Filtering: ${filteringStatus}`);
  
  const passedTests = Object.values(testResults).filter(result => result === true).length;
  const totalTests = Object.keys(testResults).length + Object.keys(testResults.apiEndpoints).length;
  
  console.log(chalk.blue(`\n📈 Overall Score: ${passedTests}/${totalTests} tests passed`));
  
  if (testResults.serverHealth && testResults.orbcommConnection && testResults.filtering) {
    console.log(chalk.green.bold('\n🎉 ORBCOMM API Server is working correctly!'));
  } else {
    console.log(chalk.red.bold('\n❌ Some tests failed. Check the logs above.'));
  }
  
  console.log(chalk.gray('\n💡 Tips:'));
  console.log(chalk.gray('   - Make sure the server is running: npm run dev'));
  console.log(chalk.gray('   - Check ORBCOMM connection in server logs'));
  console.log(chalk.gray('   - Verify API key configuration'));
  console.log(chalk.gray('   - Wait for real ORBCOMM data if no assets found'));
}

// Main test execution
async function runTests() {
  console.log(chalk.blue(`🔍 Testing server at: ${TEST_CONFIG.serverUrl}`));
  console.log(chalk.blue(`🔑 Using API key: ${TEST_CONFIG.apiKey}`));
  
  try {
    // Run tests in sequence
    await testServerHealth();
    await wait(1000);
    
    if (testResults.serverHealth) {
      await testApiEndpoints();
      await wait(1000);
      
      await testDataFormats();
      await wait(1000);
      
      await testWebSocketConnection();
    } else {
      console.log(chalk.red('\n❌ Server not accessible. Skipping remaining tests.'));
      console.log(chalk.yellow('💡 Make sure to start the server first: npm run dev'));
    }
    
    printTestSummary();
    
  } catch (error) {
    console.log(chalk.red(`\n💥 Test execution failed: ${error.message}`));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 Test interrupted by user'));
  printTestSummary();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(chalk.red(`\n💥 Unhandled rejection: ${reason}`));
  process.exit(1);
});

// Start tests
runTests().then(() => {
  console.log(chalk.gray('\n✨ Test execution completed'));
  process.exit(0);
}).catch((error) => {
  console.log(chalk.red(`\n💥 Test failed: ${error.message}`));
  process.exit(1);
});