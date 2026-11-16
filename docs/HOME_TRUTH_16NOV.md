Server time zone: Asia/Colombo | DB now: Mon Nov 16 2026 13:34:25 GMT+0530 (India Standard Time) | DB today: Mon Nov 16 2026 00:00:00 GMT+0530 (India Standard Time) | JS now: Mon Nov 16 2026 13:34:26 GMT+0530 (India Standard Time)
OK   Sales today                home=0  sql=0
OK   Bills today                home=0  sql=0
OK   Sales this week            home=0  sql=0
OK   Bills this week            home=0  sql=0
OK   Sales this month           home=0  sql=0
OK   Bills this month           home=0  sql=0
OK   Sales yesterday            home=0  sql=0
OK   Stock items                home=204  sql=204
OK   Stock cost value           home=4,198,385  sql=4,198,385
OK   Cheques pending            home=1,350,000  sql=1,350,000
OK   We owe vendors             home=3,596,170  sql=3,596,170
--- facts that explain odd numbers ---
Voided bills today (not counted): 0 worth 0
Bills today stamped exactly 00:00 (look back-dated): 0
Bills dated in the future: 0
Active items with NO cost (profit and stock value are low because of them): 0
Active items with no selling price: 0
Items with NEGATIVE stock (counted as 0 on Home): 0
Item codes used by two items: 0
RESULT: Home matches plain SQL on every number checked. If a number still looks wrong to AJ the data (facts above) is the reason, not the screen.

---
## Step 4: facts that are not 0
None. Voided, 00:00, future bills, no-cost, no-price, negative stock, duplicate codes are all 0, so no data fact changes any Home card.

## Step 5: what the Home SCREEN shows (13:34, signed in, app browser) next to SQL
| Card | Screen | SQL (script) | Match |
|---|---|---|---|
| Sales today / Bills today | LKR 0 / 0 | 0 / 0 | yes |
| This week / This month | LKR 0 / LKR 0 | 0 / 0 | yes |
| Profit today / month | "-" (no costed items sold) | n/a | n/a |
| Expenses today | LKR 0 | not checked | n/a |
| STOCK VALUE (COST) | **LKR 0** (but says 204 items, 1,473 pieces) | 4,198,385 | **NO** |
| STOCK VALUE (SELLING) | **LKR 0** | not checked | suspect |
| OUT OF STOCK card | **0**, Low stock 0 | not checked | **NO** (the Needs attention bar says 44 items out of stock, and Reorder list shows OUT items) |
| WE OWE VENDORS | **LKR 0**, "10 open bills" | 3,596,170 | **NO** (the "Vendors we owe" list below shows 1,389,625 + 798,145 + 494,300 + 474,000 + 365,000 ...) |
| CHEQUES PENDING | **LKR 0**, "6 cheques" | 1,350,000 | **NO** (the "Next cheques" list below shows real amounts) |
| CUSTOMERS OWE US / INVESTOR LOANS | 0 / 0 | not checked | n/a |

Reasoning: the script reads the database the same way Home's route does and agrees on all 11 numbers, so the data is fine. The wrong cards are only the ones that show LKR 0 while the lists and counts beside them are correct (stock value, out of stock, owe vendors, cheques pending). That points at the screen: those four number cards are not filled from the same field the lists use (or are shown before the data arrives, or the 'no count-up' change of task 260 left them at the start value 0). Sales/bills cards are 0 because no sale today, which is true.
Next for chat: check public/dashboard_v2.js / dashboard_pro.js where these four cards write their number (task 260 removed the count-up).
