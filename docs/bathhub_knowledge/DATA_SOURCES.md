# DATA SOURCES — Confirmed File Formats

## 1. Daily Excel
Columns: DATE / RECEPT NO / SALES / CASH / CARD / ONLINE / CHEQ / CREDIT
Sales only — truth from day one.

## 2. RepSalesAnalysis_*.xlsx
Columns: DATE / NUMBER / CUSTOMER / CODE / DESCRIPTION / QTY / UOM / U-COST / U-PRICE / U-DISC / AMOUNT
Item-level GP.

## 3. Sales Accounts (accountant)
Tab-per-day. Item sales on top, expenses in the middle, net profit at the bottom.
Ground truth for net profit where available.

## 4. Handwritten paper
Date, petty 25,000 float, expenses on the left, payments on the right, summary at the bottom
(total sale / cash / card / online / credit / cash in hand).

## 5. Staff note pad
Date, names + amounts, total salary.
