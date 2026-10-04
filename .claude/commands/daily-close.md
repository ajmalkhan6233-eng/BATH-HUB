Enter the daily close figures for $ARGUMENTS.

Steps:
1. Ask the user for: date (default today), total sale, cash sale, card sale, online sale, credit sale, expenses (with breakdown), payments (with supplier names), salary paid, cash in hand
2. POST to http://localhost:3000/api/daily-close with the data
3. Run CHECKER on that day: POST to http://localhost:3000/api/checker-run
4. Ask if user wants to send it

Format all amounts as LKR X,XXX,XXX
