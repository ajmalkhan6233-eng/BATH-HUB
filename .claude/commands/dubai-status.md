# /dubai-status
Show current status of Dubai Imports inventory tracker app.

**Project:** Dubai Imports — Internal inventory tracker for Bath Hub Aromatic perfume imports (Kuwait & Dubai)
**Folder:** C:\dubai-imports\
**Stack:** Node/Express API (port 3002) + React/Vite frontend (port 5174 dev)
**DB:** PostgreSQL — `dubai_imports` database (postgres/Bathco2026)

## Features Built
- Dashboard — stats: stock value, shipment counts, recent shipments
- Shipments — create/track import shipments, status pipeline (pending → in_transit → arrived → cleared)
- Shipment Detail — add items, landed cost calculator (goods + shipping + customs + handling ÷ units), auto-stock update on arrival
- Products — full catalog CRUD, filter by origin/category
- Stock — on-hand levels per product, manual override, margin calc, low-stock alert

## Products Seeded (15)
From Bath Hub Aromatic shop_config.json — Oud, Men's, Women's, Unisex across Kuwait & Dubai

## Pending / Next Steps
- [ ] Add selling prices to products
- [ ] Log first real shipment
- [ ] pm2 setup for always-on
- [ ] Link LAYLA WhatsApp bot stock checks to this DB
