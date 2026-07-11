# WhatsApp bridge

- whatsapp-bridge.js, runs as its own pm2 process. First run shows a QR (http://localhost:BRIDGEPORT/qr)
  — scan with the business phone. Session persists in .wwebjs_auth/.
- MODE: WHATSAPP_MODE env — 'internal' (DEFAULT) = whitelist-only (WHATSAPP_TEST_WHITELIST
  numbers), everyone else silently dropped; 'public' = replies to everyone. Going public is a
  deliberate .env change, never a code-default flip.
- Outbound guard: every send path runs utils/laylaOutput.sanitizeAssistantOutput() as the final
  reasoning-leak filter, on top of layla.js's own pipeline. Do not remove either layer.
- Port: WHATSAPP_BRIDGE_PORT (this template instance: 3011). Do NOT start this bridge on a machine
  running another live bridge — the orphan-browser cleanup kills ANY Chrome holding a wwebjs_auth
  session, including the live one.
- Self-healing: liveness check every few minutes + immediate process.exit on 'disconnected'
  (pm2 autorestarts). Machine must not sleep: keep AC sleep/hibernate = Never
  (powercfg /change standby-timeout-ac 0 ; hibernate-timeout-ac 0).
- If session breaks permanently: stop bridge, delete .wwebjs_auth/, restart, rescan QR.
