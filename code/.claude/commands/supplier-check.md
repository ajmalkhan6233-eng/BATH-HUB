Check supplier payment status for $ARGUMENTS (optional supplier name or leave blank for all).

Steps:
1. GET http://localhost:3000/api/suppliers
2. Show all suppliers with: Name, Category, Total Paid, Last Payment Date, Outstanding Cheques
3. Flag any supplier not paid in > 30 days as overdue
4. GET /api/cheques for pending cheques by supplier
5. Show total outstanding to all suppliers
6. If specific supplier given, show full payment history
