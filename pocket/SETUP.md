# RBH Pocket: one-time setup (all free)
1. Cloudflare dashboard > Workers & Pages > Create Worker > paste `cloudflare/pocket_worker.js` > Deploy.
2. Worker > Settings > Variables: add `PUSH_SECRET` and `READ_TOKEN` (two long random texts) and a KV namespace binding named `SNAP`.
3. Shop PC `.env`: `POCKET_URL=https://<worker>.workers.dev`, `POCKET_PUSH_SECRET=<same as PUSH_SECRET>`, `POCKET_PASSCODE=<AJ's passcode, 10+ characters>`. Restart `apex-server`.
4. Put the `pocket/` folder online free: Cloudflare Pages (Upload assets) or GitHub Pages. It holds NO shop numbers, only the app shell.
5. On the iPhone open once: `https://<pages-address>/#t=<READ_TOKEN>&w=https://<worker>.workers.dev` then Share > Add to Home Screen. Enter the passcode to open.
Numbers refresh every 10 minutes while the shop PC is on. PC off: the phone shows the last copy, marked "shop PC may be off".
