Run CHECKER agent to verify all daily records for $ARGUMENTS (optional date range YYYY-MM-DD:YYYY-MM-DD).

Steps:
1. POST to http://localhost:3000/api/checker-run
2. Show results: how many days checked, how many flagged, list all flags with dates
3. For each flagged day, show what the issue is (mismatch, high expenses, cash shortfall, etc.)
4. Ask if user wants to correct any flagged records

Flag types:
- breakdown_mismatch: cash+card+online+credit != total
- high_expenses: expenses > 60% of sales
- cash_short: negative cash in hand
- zero_sale_day: no sales recorded on a weekday
- gp_anomaly: GP > sales or GP < -20% of sales
