Refresh the Royal Bath Hub dashboard at localhost:3000 with latest data.

Steps:
1. Check if server is running: GET http://localhost:3000/api/home-stats
   (Do NOT start any server automatically. Ask Aj to start it. Never touch the live system.)
3. Run CHECKER: POST http://localhost:3000/api/checker-run
4. Check DB row counts for all tables
5. Show what data is loaded: days, months, staff count, supplier count, credit customers
6. Show the URL to open: http://localhost:3000
7. List any missing data that should be added

Dashboard pages:
- Home: KPI overview, weekly/monthly charts
- Daily: calendar view, click any day for details
- Weekly: week-by-week comparison
- Monthly: month totals with GP breakdown
- Staff: all staff salary and commission
- Suppliers: ledger and payment history
- Credits: aging report
- Agents: VERA/CHECKER/NOVA/QUINN live results
