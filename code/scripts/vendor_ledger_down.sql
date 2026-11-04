-- Rollback for the vendor ledger (drops only the 4 new tables). Take a backup first.
DROP TABLE IF EXISTS vendor_credit_notes;
DROP TABLE IF EXISTS vendor_payments;
DROP TABLE IF EXISTS vendor_bill_cheques;
DROP TABLE IF EXISTS vendor_bills;
