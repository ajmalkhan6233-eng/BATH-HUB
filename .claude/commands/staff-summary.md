Show staff summary and salary history for $ARGUMENTS (optional staff name or leave blank for all).

Steps:
1. GET http://localhost:3000/api/staff
2. Show table: Name, Role, Base Salary, Total Earned, Commission, Loans Outstanding
3. For each active staff member, show last payment date and any pending loans
4. Calculate 1% GP commission for each salesperson based on current month's GP
5. Show who is due for salary payment
6. If specific name given, show full history: all salary payments, all loans, all commission records

Commission: 1% of Gross Profit (all sales staff)
