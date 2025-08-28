const mysql = require('mysql2/promise');

async function testLocalhost() {
  try {
    console.log('Testing localhost connection...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      connectTimeout: 10000,
      ssl: false
    });
    
    console.log('✅ Localhost connection successful!');
    await connection.end();
    
  } catch (error) {
    console.log('❌ Localhost failed:', error.message);
  }
}

async function testWindowsIP() {
  const ips = ['172.28.48.1', '127.0.0.1'];
  
  for (const ip of ips) {
    try {
      console.log(`Testing ${ip}...`);
      
      const connection = await mysql.createConnection({
        host: ip,
        port: 3306,
        user: 'root',
        password: '',
        connectTimeout: 10000,
        ssl: false
      });
      
      console.log(`✅ ${ip} connection successful!`);
      await connection.end();
      return ip;
      
    } catch (error) {
      console.log(`❌ ${ip} failed:`, error.message);
    }
  }
  
  return null;
}

async function testConnections() {
  console.log('=== MySQL Connection Test ===\n');
  
  await testLocalhost();
  const workingIP = await testWindowsIP();
  
  if (!workingIP) {
    console.log('\n🔧 XAMPP Configuration Required:');
    console.log('1. Open XAMPP on Windows');
    console.log('2. Start MySQL service');
    console.log('3. Open phpMyAdmin');
    console.log('4. Go to User accounts');
    console.log('5. Edit root user or create new user');
    console.log('6. Add host: % (for any host) or your WSL IP');
    console.log('7. Or try setting password for root user');
  } else {
    console.log(`\n✅ Use this IP in your .env file: ${workingIP}`);
  }
}

testConnections();