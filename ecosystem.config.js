const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'ourspace',
      script: './server/index.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 3001,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        DB_PATH: process.env.DB_PATH || '/var/data/ourspace/ourspace.db',
        UPLOADS_PATH: process.env.UPLOADS_PATH || '/var/data/ourspace/uploads',
        CORS_ORIGIN: process.env.CORS_ORIGIN
      },
      error_file: '/var/log/ourspace/error.log',
      out_file: '/var/log/ourspace/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '300M',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 8000
    }
  ]
};
