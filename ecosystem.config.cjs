/**
 * PM2 ecosystem for Marketplace (production).
 *
 * Domenlar:
 *   selliostore.uz          → landing       (port 2404)
 *   admin.selliostore.uz    → admin panel   (port 2402)
 *   clients.selliostore.uz  → webapp        (port 2401)
 *   dev.selliostore.uz      → super admin   (port 2403)
 *   selliostore.uz/api/*    → backend API   (port 2400, internal only)
 *
 * Boshqa loyihalardan ajratish uchun nomlarda `marketplace-` prefiks.
 */
module.exports = {
  apps: [
    {
      name: 'marketplace-api',
      cwd: '/opt/marketplace/backend',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
        PORT: '2400',
        WEBAPP_URL: 'https://clients.selliostore.uz',
        ADMIN_URL: 'https://admin.selliostore.uz',
        SUPERADMIN_URL: 'https://dev.selliostore.uz',
        LANDING_URL: 'https://selliostore.uz',
        // Telegram webhook bazasi. Server ko'chganda Telegram DNS keshi avvalgi
        // subdomenni eski IP da ushlab qolishi mumkin — shu sababli keshlanmagan
        // subdomenga (dev.) yo'naltiramiz. Hammasi bir xil IP ga A-record.
        APP_URL: 'https://dev.selliostore.uz',
      },
      out_file: '/opt/marketplace/logs/api.out.log',
      error_file: '/opt/marketplace/logs/api.err.log',
      time: true,
    },
    {
      name: 'marketplace-webapp',
      cwd: '/opt/marketplace/webapp',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 2401',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        BACKEND_URL: 'http://127.0.0.1:2400',
      },
      out_file: '/opt/marketplace/logs/webapp.out.log',
      error_file: '/opt/marketplace/logs/webapp.err.log',
      time: true,
    },
    {
      name: 'marketplace-admin',
      cwd: '/opt/marketplace/admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 2402',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        BACKEND_URL: 'http://127.0.0.1:2400',
      },
      out_file: '/opt/marketplace/logs/admin.out.log',
      error_file: '/opt/marketplace/logs/admin.err.log',
      time: true,
    },
    {
      name: 'marketplace-superadmin',
      cwd: '/opt/marketplace/superadmin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 2403',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        BACKEND_URL: 'http://127.0.0.1:2400',
      },
      out_file: '/opt/marketplace/logs/superadmin.out.log',
      error_file: '/opt/marketplace/logs/superadmin.err.log',
      time: true,
    },
    {
      name: 'marketplace-landing',
      cwd: '/opt/marketplace/landing',
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: '2404',
      },
      out_file: '/opt/marketplace/logs/landing.out.log',
      error_file: '/opt/marketplace/logs/landing.err.log',
      time: true,
    },
  ],
};
