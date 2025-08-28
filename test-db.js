const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('Testing WSL to Windows XAMPP MySQL connection...');
    console.log('Host: 172.28.48.1:3306');
    console.log('User: root');
    console.log('Password: (empty)');
    
    const connection = await mysql.createConnection({
      host: '172.28.48.1',
      port: 3306,
      user: 'root',
      password: '',
      connectTimeout: 10000,
      ssl: false
    });
    
    console.log('✅ Connected successfully!');
    
    // Test basic query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query test successful:', rows);
    
    // Test database creation
    await connection.execute('CREATE DATABASE IF NOT EXISTS orbcomm_kagu');
    console.log('✅ Database creation successful');
    
    await connection.end();
    console.log('✅ Connection closed successfully');
    
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    console.log('\n📋 Troubleshooting checklist:');
    console.log('1. Is XAMPP running on Windows?');
    console.log('2. Is MySQL service started in XAMPP?');
    console.log('3. Is MySQL listening on port 3306?');
    console.log('4. Is Windows Firewall blocking the connection?');
    console.log('5. Try: netstat -an | find "3306" (Windows)');
    console.log('6. Try: telnet 172.28.48.1 3306 (from WSL)');
  }
}

testConnection();