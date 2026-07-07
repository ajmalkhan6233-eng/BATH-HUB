# WhatsApp bridge

- whatsapp-bridge.js, runs as its own pm2 process. First run shows a QR (http://localhost:BRIDGEPORT/qr)
  — scan with the business phone. Session persists in .wwebjs_auth/.
- TEST MODE: WHATSAPP_TEST_WHITELIST env — when set, only that number gets replies.
  Go live by removing/adjusting it per the comments in the file.
- Self-healing: liveness check every few minutes + immediate process.exit on 'disconnected'
  (pm2 autorestarts). Machine must not sleep: keep AC sleep/hibernate = Never
  (powercfg /change standby-timeout-ac 0 ; hibernate-timeout-ac 0).
- If session breaks permanently: stop bridge, delete .wwebjs_auth/, restart, rescan QR.
