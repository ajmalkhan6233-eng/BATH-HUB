# Run and verify — after EVERY change

1. Syntax check any .js you touched:  `node -c server.js`
2. Start (dev):    `node server.js`   (uses PORT from .env)
   Start (prod):   `pm2 restart bathco-server` (and `whatsapp-bridge` if you touched it)
3. Open http://localhost:PORT/ — the app must load with no console errors.
4. If you changed BATHCO_NATURE.html: hard-refresh (Ctrl+F5), click into the page you changed.
5. If anything is broken: undo your edit, verify it works again, then retry smaller.

NEVER leave the system in a state where the page does not load.
