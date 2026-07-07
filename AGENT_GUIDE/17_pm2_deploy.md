# Processes / pm2

- ecosystem.config.js defines: bathco-server (web app), grn-watcher, whatsapp-bridge.
- Start all: pm2 start ecosystem.config.js ; persist: pm2 save (+ pm2-startup on Windows).
- Logs: pm2 logs bathco-server --lines 50 ; files server.log / *_err.log in root.
- Restart after any backend change: pm2 restart bathco-server (add --update-env if .env changed).
- Status check: pm2 ls — all three should be "online"; restart-count column climbing fast = crash
  loop, read the error log before touching anything else.
