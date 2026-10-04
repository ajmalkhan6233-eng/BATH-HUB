# /report-gen - Generate Report

Generate a daily/weekly business report for Bath Hub including sales, expenses, and net profit.

## Purpose
Produce a structured business performance report from available sales and financial data.

## Inputs
- Period: `daily` or `weekly` (default: daily)
- Date or date range (default: today / current week)
- Source files: `BATH HUB\DAY SALE\DD-MM-YYYY.xlsx` for daily register; Lasersoft exports in `BATH HUB\data\` for GP/cost

## Outputs
- Summary table: Total Sales | Cash | Card | Online | Cheque | Credit
- GP and net profit estimate (using ~18% GP margin unless Lasersoft data available)
- Notable remarks (e.g. large credits, unusual payments)
- Saved HTML report to `BATH HUB\reports\report-YYYY-MM-DD.html`

## Workflow
1. Read the relevant DAY SALE file(s)
2. Aggregate sales, payment method totals, and credit
3. Pull GP data from Lasersoft export if available
4. Calculate net profit estimate
5. Render and save HTML report
6. Print summary to terminal
