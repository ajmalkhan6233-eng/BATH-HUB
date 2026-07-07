module.exports = {
  apps: [
    {
      name: "bathco-server",
      script: "./server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production", PORT: 3010 },
      error_file: "./server_err.log",
      out_file: "./server.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      exp_backoff_restart_delay: 100
    },
    {
      name: "grn-watcher",
      script: "./grn-watcher.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "256M",
      env: { NODE_ENV: "production" },
      error_file: "./grn_watcher_err.log",
      out_file: "./grn_watcher.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      exp_backoff_restart_delay: 200
    },
    {
      name: "whatsapp-bridge",
      script: "./whatsapp-bridge.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      error_file: "./whatsapp_bridge_err.log",
      out_file: "./whatsapp_bridge.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      exp_backoff_restart_delay: 200
    }
  ]
};
