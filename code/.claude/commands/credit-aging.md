Show credit aging report for all credit customers.

Steps:
1. GET http://localhost:3000/api/credit-customers
2. Build aging buckets:
   - Current (not yet due)
   - 1-30 days overdue
   - 31-60 days overdue
   - 61-90 days overdue
   - 90+ days overdue (CRITICAL)
3. Show total in each bucket
4. List all customers with amount, days overdue, contact number
5. Calculate total outstanding credit
6. Flag customers with > 90 days as requiring immediate collection
7. Show recommended actions

For each overdue customer: send reminder, escalate to owner, or write off.
