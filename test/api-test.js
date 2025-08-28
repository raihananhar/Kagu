const http = require('http');
const chalk = require('chalk');

console.log(chalk.blue.bold('🔌 ORBCOMM API Endpoints Test'));
console.log(chalk.gray('=' .repeat(50)));

const TEST_CONFIG = {
  serverUrl: 'http://localhost:3000',
  apiKey: 'api_key_kagu_12345',
  testAssetId: 'KAGU3331339',
  expectedAssets: [
    'TRIU8784787', 'KAGU3330950', 'KAGU3330820', 'SZLU9721417', 'SZLU3961914',
    'KAGU3331180', 'KAGU3331339', 'KAGU3331283', 'KAGU7771228', 'KAGU3331302'
  ],
  expectedAssetCount: 10
};

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
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testEndpoint(name, path, expectedFields = []) {
  console.log(chalk.yellow(`\n🧪 Testing: ${name}`));
  console.log(chalk.gray(`   Path: ${path}`));
  
  try {
    const response = await makeRequest(`${TEST_CONFIG.serverUrl}${path}`);
    
    if (response.status === 200) {
      console.log(chalk.green(`   ✅ Success (${response.status})`));
      
      if (expectedFields.length > 0) {
        expectedFields.forEach(field => {
          if (response.data[field] !== undefined) {
            console.log(chalk.blue(`   📋 ${field}: ${JSON.stringify(response.data[field]).substring(0, 50)}...`));
          } else {
            console.log(chalk.red(`   ❌ Missing field: ${field}`));
          }
        });
      }
      
      // Show response time
      const contentLength = response.headers['content-length'] || 'unknown';
      console.log(chalk.blue(`   📊 Content-Length: ${contentLength} bytes`));
      
    } else if (response.status === 404) {
      console.log(chalk.yellow(`   ⚠️  Not Found (${response.status}) - Asset may not exist yet`));
    } else {
      console.log(chalk.red(`   ❌ Failed (${response.status})`));
      console.log(chalk.red(`   Error: ${JSON.stringify(response.data)}`));
    }
    
    return response.status === 200;
    
  } catch (error) {
    console.log(chalk.red(`   ❌ Request failed: ${error.message}`));
    return false;
  }
}

async function testFormats(basePath) {
  console.log(chalk.yellow(`\n📄 Testing Export Formats for: ${basePath}`));
  
  const formats = ['json', 'csv', 'xml'];
  
  for (const format of formats) {
    try {
      const response = await makeRequest(`${TEST_CONFIG.serverUrl}${basePath}?format=${format}`);
      
      if (response.status === 200) {
        console.log(chalk.green(`   ✅ ${format.toUpperCase()}: Success`));
        
        const contentType = response.headers['content-type'] || 'unknown';
        const contentLength = response.headers['content-length'] || 'unknown';
        
        console.log(chalk.blue(`      Content-Type: ${contentType}`));
        console.log(chalk.blue(`      Content-Length: ${contentLength} bytes`));
        
        if (format === 'csv' && typeof response.data === 'string') {
          const lines = response.data.split('\n');
          console.log(chalk.blue(`      CSV Lines: ${lines.length}`));
          console.log(chalk.blue(`      CSV Header: ${lines[0]?.substring(0, 60)}...`));
        } else if (format === 'xml' && typeof response.data === 'string') {
          console.log(chalk.blue(`      XML Root: ${response.data.includes('<response>') ? 'Valid' : 'Invalid'}`));
        }
        
      } else if (response.status === 404) {
        console.log(chalk.yellow(`   ⚠️  ${format.toUpperCase()}: Asset not found`));
      } else {
        console.log(chalk.red(`   ❌ ${format.toUpperCase()}: Failed (${response.status})`));
      }
      
    } catch (error) {
      console.log(chalk.red(`   ❌ ${format.toUpperCase()}: Error - ${error.message}`));
    }
  }
}

async function testRateLimit() {
  console.log(chalk.yellow('\n⏱️  Testing Rate Limiting'));
  
  const requests = [];
  const startTime = Date.now();
  
  // Send 10 rapid requests
  for (let i = 0; i < 10; i++) {
    requests.push(makeRequest(`${TEST_CONFIG.serverUrl}/api/kagu/assets`));
  }
  
  try {
    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successCount = responses.filter(r => r.status === 200).length;
    const rateLimitCount = responses.filter(r => r.status === 429).length;
    
    console.log(chalk.blue(`   📊 Sent 10 requests in ${duration}ms`));
    console.log(chalk.blue(`   ✅ Successful: ${successCount}`));
    console.log(chalk.blue(`   🚫 Rate Limited: ${rateLimitCount}`));
    
    if (rateLimitCount === 0) {
      console.log(chalk.green('   ✅ All requests succeeded - Rate limit not triggered'));
    } else {
      console.log(chalk.yellow('   ⚠️  Rate limiting is working'));
    }
    
  } catch (error) {
    console.log(chalk.red(`   ❌ Rate limit test failed: ${error.message}`));
  }
}

async function runApiTests() {
  console.log(chalk.blue(`🔍 Testing API at: ${TEST_CONFIG.serverUrl}`));
  console.log(chalk.blue(`🔑 Using API key: ${TEST_CONFIG.apiKey}`));
  
  try {
    // Test health endpoint (no auth required)
    await testEndpoint('Server Health', '/health', ['status', 'orbcomm', 'timestamp']);
    
    // Test KAGU assets endpoint
    const assetsSuccess = await testEndpoint(
      'KAGU Assets List', 
      '/api/kagu/assets', 
      ['clientId', 'assets', 'pagination', 'timestamp']
    );
    
    // Test specific asset endpoints
    await testEndpoint(
      'Asset Latest Data', 
      `/api/kagu/asset/${TEST_CONFIG.testAssetId}/latest`,
      ['clientId', 'assetId', 'timestamp', 'gpsData', 'reeferData']
    );
    
    await testEndpoint(
      'Asset GPS Data', 
      `/api/kagu/asset/${TEST_CONFIG.testAssetId}/gps`,
      ['clientId', 'assetId', 'gps']
    );
    
    await testEndpoint(
      'Asset Reefer Data', 
      `/api/kagu/asset/${TEST_CONFIG.testAssetId}/reefer`,
      ['clientId', 'assetId', 'reefer']
    );
    
    // Test export formats
    await testFormats(`/api/kagu/asset/${TEST_CONFIG.testAssetId}/latest`);
    
    // Test pagination
    console.log(chalk.yellow('\n📄 Testing Pagination'));
    await testEndpoint(
      'Paginated Assets (limit=2)', 
      '/api/kagu/assets?limit=2&offset=0',
      ['assets', 'pagination']
    );
    
    // Test rate limiting
    await testRateLimit();
    
    // Test authentication
    console.log(chalk.yellow('\n🔐 Testing Authentication'));
    try {
      const noAuthResponse = await makeRequest(`${TEST_CONFIG.serverUrl}/api/kagu/assets`, {
        headers: {} // No API key
      });
      
      if (noAuthResponse.status === 401) {
        console.log(chalk.green('   ✅ Unauthorized access properly rejected'));
      } else {
        console.log(chalk.red(`   ❌ Expected 401, got ${noAuthResponse.status}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Auth test failed: ${error.message}`));
    }
    
    console.log(chalk.green.bold('\n🎉 API testing completed!'));
    
  } catch (error) {
    console.log(chalk.red(`\n💥 Test execution failed: ${error.message}`));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 API tests interrupted by user'));
  process.exit(0);
});

// Start API tests
runApiTests().then(() => {
  console.log(chalk.gray('\n✨ API test execution completed'));
  process.exit(0);
}).catch((error) => {
  console.log(chalk.red(`\n💥 API tests failed: ${error.message}`));
  process.exit(1);
});