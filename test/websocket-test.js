const WebSocket = require('ws');
const chalk = require('chalk');

console.log(chalk.blue.bold('🔗 ORBCOMM WebSocket Real-time Test'));
console.log(chalk.gray('=' .repeat(50)));

const TEST_CONFIG = {
  wsUrl: 'ws://localhost:3000/ws/kagu',
  apiKey: 'api_key_kagu_12345',
  testDuration: 30000, // 30 seconds
  expectedAssets: [
    'TRIU8784787', 'KAGU3330950', 'KAGU3330820', 'SZLU9721417', 'SZLU3961914',
    'KAGU3331180', 'KAGU3331339', 'KAGU3331283', 'KAGU7771228', 'KAGU3331302'
  ],
  expectedAssetCount: 10
};

class WebSocketTester {
  constructor() {
    this.ws = null;
    this.messageCount = 0;
    this.connectionConfirmed = false;
    this.assetUpdatesReceived = [];
    this.heartbeatsReceived = 0;
    this.startTime = null;
    this.testTimer = null;
  }

  async runTest() {
    console.log(chalk.blue(`🔍 Testing WebSocket: ${TEST_CONFIG.wsUrl}`));
    console.log(chalk.blue(`🔑 API Key: ${TEST_CONFIG.apiKey}`));
    console.log(chalk.blue(`⏱️  Test Duration: ${TEST_CONFIG.testDuration / 1000} seconds`));
    
    return new Promise((resolve, reject) => {
      try {
        this.connect();
        
        // Set test timeout
        this.testTimer = setTimeout(() => {
          this.disconnect();
          resolve(this.generateReport());
        }, TEST_CONFIG.testDuration);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  connect() {
    const wsUrl = `${TEST_CONFIG.wsUrl}?apiKey=${TEST_CONFIG.apiKey}`;
    console.log(chalk.yellow('\n🔗 Connecting to WebSocket...'));
    console.log(chalk.gray(`   URL: ${wsUrl}`));
    
    this.ws = new WebSocket(wsUrl);
    this.startTime = Date.now();

    this.ws.on('open', () => {
      console.log(chalk.green('✅ WebSocket connection established'));
      this.logEvent('Connected');
    });

    this.ws.on('message', (data) => {
      this.messageCount++;
      this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      console.log(chalk.blue(`📤 WebSocket closed: ${code} - ${reason}`));
      this.logEvent(`Disconnected: ${code} - ${reason}`);
    });

    this.ws.on('error', (error) => {
      console.log(chalk.red(`❌ WebSocket error: ${error.message}`));
      this.logEvent(`Error: ${error.message}`);
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      const timestamp = new Date().toISOString();
      
      console.log(chalk.cyan(`📨 Message #${this.messageCount} (${timestamp.split('T')[1].split('.')[0]})`));
      
      switch (message.type) {
        case 'connection':
          this.connectionConfirmed = true;
          console.log(chalk.green('   ✅ Connection Confirmation'));
          console.log(chalk.blue(`      Client ID: ${message.clientId}`));
          console.log(chalk.blue(`      Asset Patterns: ${message.assetPatterns?.join(', ')}`));
          console.log(chalk.blue(`      Total Assets: ${message.totalAssets}`));
          
          if (message.permissions) {
            const permissions = Object.entries(message.permissions)
              .filter(([key, value]) => value)
              .map(([key]) => key);
            console.log(chalk.blue(`      Permissions: ${permissions.join(', ')}`));
          }
          break;

        case 'heartbeat':
          this.heartbeatsReceived++;
          console.log(chalk.magenta(`   💓 Heartbeat #${this.heartbeatsReceived}`));
          
          if (message.orbcommStatus) {
            console.log(chalk.blue(`      ORBCOMM Connected: ${message.orbcommStatus.connected}`));
            console.log(chalk.blue(`      Assets Tracked: ${message.orbcommStatus.assetsTracked}`));
          }
          break;

        default:
          if (message.assetId) {
            this.assetUpdatesReceived.push({
              assetId: message.assetId,
              timestamp: message.timestamp,
              hasGPS: message.gpsData?.hasGPS,
              hasReefer: message.reeferData?.hasReeferData
            });
            
            console.log(chalk.green('   📊 Asset Data Update'));
            console.log(chalk.blue(`      Asset ID: ${message.assetId}`));
            console.log(chalk.blue(`      Device ID: ${message.deviceId}`));
            console.log(chalk.blue(`      Event Class: ${message.eventClass}`));
            console.log(chalk.blue(`      Timestamp: ${message.timestamp}`));
            
            if (message.gpsData?.hasGPS) {
              console.log(chalk.blue(`      🌍 GPS: ${message.gpsData.latitude}, ${message.gpsData.longitude}`));
            } else {
              console.log(chalk.gray('      🌍 GPS: Not available'));
            }
            
            if (message.reeferData?.hasReeferData) {
              console.log(chalk.blue(`      🌡️  Reefer: Amb=${message.reeferData.ambientTemp}°C, Sup=${message.reeferData.supplyTemp1}°C, Set=${message.reeferData.setTemp}°C`));
            } else {
              console.log(chalk.gray('      🌡️  Reefer: Not available'));
            }
            
            if (message.deviceData) {
              console.log(chalk.blue(`      🔋 Power: Ext=${message.deviceData.extPower}, Battery=${message.deviceData.batteryVoltage}V`));
            }
          } else {
            console.log(chalk.yellow(`   ❓ Unknown message type: ${Object.keys(message).join(', ')}`));
          }
          break;
      }
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Error parsing message: ${error.message}`));
    }
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    if (this.testTimer) {
      clearTimeout(this.testTimer);
    }
  }

  logEvent(event) {
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    console.log(chalk.gray(`   ⏱️  ${event} (${elapsed}ms elapsed)`));
  }

  generateReport() {
    console.log(chalk.yellow('\n📊 WebSocket Test Report'));
    console.log(chalk.gray('-'.repeat(40)));
    
    const testDuration = this.startTime ? Date.now() - this.startTime : 0;
    
    console.log(chalk.blue(`📈 Test Summary:`));
    console.log(chalk.blue(`   Duration: ${testDuration}ms (${(testDuration / 1000).toFixed(1)}s)`));
    console.log(chalk.blue(`   Total Messages: ${this.messageCount}`));
    console.log(chalk.blue(`   Connection Confirmed: ${this.connectionConfirmed ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.blue(`   Heartbeats Received: ${this.heartbeatsReceived}`));
    console.log(chalk.blue(`   Asset Updates: ${this.assetUpdatesReceived.length}`));
    
    if (this.assetUpdatesReceived.length > 0) {
      console.log(chalk.green('\n🎯 Asset Updates Received:'));
      
      // Group by asset ID
      const assetGroups = {};
      this.assetUpdatesReceived.forEach(update => {
        if (!assetGroups[update.assetId]) {
          assetGroups[update.assetId] = [];
        }
        assetGroups[update.assetId].push(update);
      });
      
      Object.entries(assetGroups).forEach(([assetId, updates]) => {
        console.log(chalk.blue(`   📍 ${assetId}: ${updates.length} updates`));
        
        const withGPS = updates.filter(u => u.hasGPS).length;
        const withReefer = updates.filter(u => u.hasReefer).length;
        
        console.log(chalk.blue(`      GPS data: ${withGPS}/${updates.length}`));
        console.log(chalk.blue(`      Reefer data: ${withReefer}/${updates.length}`));
        console.log(chalk.blue(`      Latest: ${updates[updates.length - 1].timestamp}`));
      });
    }
    
    // Performance metrics
    if (this.messageCount > 0 && testDuration > 0) {
      const messagesPerSecond = (this.messageCount / (testDuration / 1000)).toFixed(2);
      console.log(chalk.blue(`\n⚡ Performance:`));
      console.log(chalk.blue(`   Messages/second: ${messagesPerSecond}`));
      
      if (this.heartbeatsReceived > 0) {
        const heartbeatInterval = testDuration / this.heartbeatsReceived;
        console.log(chalk.blue(`   Heartbeat interval: ${(heartbeatInterval / 1000).toFixed(1)}s`));
      }
    }
    
    // Test results
    console.log(chalk.yellow('\n🏁 Test Results:'));
    
    const results = {
      connection: this.connectionConfirmed,
      realTimeData: this.assetUpdatesReceived.length > 0,
      heartbeat: this.heartbeatsReceived > 0,
      performance: this.messageCount > 0
    };
    
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
      console.log(`   ${test}: ${status}`);
    });
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(chalk.blue(`\n📊 Overall Score: ${passedTests}/${totalTests} tests passed`));
    
    if (passedTests === totalTests) {
      console.log(chalk.green.bold('🎉 All WebSocket tests passed!'));
    } else {
      console.log(chalk.yellow.bold('⚠️  Some WebSocket tests failed or had no data'));
    }
    
    return {
      passed: passedTests,
      total: totalTests,
      connectionConfirmed: this.connectionConfirmed,
      assetUpdates: this.assetUpdatesReceived.length,
      heartbeats: this.heartbeatsReceived,
      duration: testDuration
    };
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 WebSocket test interrupted by user'));
  process.exit(0);
});

// Start WebSocket test
async function runWebSocketTest() {
  try {
    const tester = new WebSocketTester();
    const report = await tester.runTest();
    
    console.log(chalk.gray('\n✨ WebSocket test completed'));
    
    // Exit with appropriate code
    if (report.passed === report.total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
    
  } catch (error) {
    console.log(chalk.red(`\n💥 WebSocket test failed: ${error.message}`));
    process.exit(1);
  }
}

runWebSocketTest();