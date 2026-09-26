module.exports = {
  apps: [
    {
      name: "ai-server",
      script: "./server.js",
      autorestart: true
    },
    {
      name: "ai-tunnel",
      script: "./tunnel-sync.js",
      autorestart: true
    }
  ]
};
