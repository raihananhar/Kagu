module.exports = {
  apps: [
    {
      name: 'orbcomm-api-server',
      script: 'server.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'warn'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'warn'
      },
      // Performance monitoring
      monitoring: true,
      pmx: true,
      
      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Error handling
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Logging
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced PM2 features
      merge_logs: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Health monitoring
      health_check_url: 'http://localhost:3000/health',
      health_check_grace_period: 3000,
      
      // Source map support for better error tracking
      source_map_support: true,
      
      // Environment-specific overrides
      node_args: process.env.NODE_ENV === 'development' ? '--inspect' : undefined,
      
      // Graceful shutdown
      kill_timeout: 5000,
      shutdown_with_message: true
    }
  ],
  
  // Deployment configuration
  deploy: {
    staging: {
      user: 'deploy',
      host: ['staging-server.example.com'],
      ref: 'origin/staging',
      repo: 'git@github.com:raihananhar/Kagu.git',
      path: '/var/www/orbcomm-api-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      'pre-deploy-local': 'echo "Deploying to staging..."',
      'post-deploy-local': 'echo "Deployed to staging successfully"',
      env: {
        NODE_ENV: 'staging'
      }
    },
    
    production: {
      user: 'deploy',
      host: ['103.121.197.174'],
      ref: 'origin/main',
      repo: 'git@github.com:raihananhar/Kagu.git',
      path: '/var/www/orbcomm-api-server',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production..."',
      'post-deploy-local': 'echo "Deployed to production successfully"',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};