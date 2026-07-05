// pm2 konfiguratsiyasi — serverда Vega ilovasini boshqaradi.
// Port 3020 (serverdagi boshqa ilovalardan ajratilgan).
module.exports = {
  apps: [
    {
      name: "vega",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3020",
      cwd: "/var/www/vega",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
    },
  ],
};
