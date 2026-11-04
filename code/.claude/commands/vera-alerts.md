Run VERA agent to check all anomalies, overdue suppliers, credit customers, cash shortfalls.

Steps:
1. GET http://localhost:3000/api/vera-alerts
2. Show all critical alerts first (cash shortfalls, overdue credit)
3. Show warning alerts (low sales, high expenses)
4. Show info alerts (data gaps, spikes)
5. Show overdue credit customer list with days overdue and amount due
6. Show total outstanding credit
7. Suggest actions for each critical issue

Format: 
- CRITICAL (red): cash shortfalls, overdue credit > 30 days
- WARNING (orange): low sale days, high expenses
- INFO (blue): spikes, gaps
