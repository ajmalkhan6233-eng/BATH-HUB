-- REVERSE of the Documents module: removes only its four new tables (nothing else is touched).
-- Also delete the folders uploads/documents/ and uploads/inbox/ if you want the files gone.
-- Optional (left commented on purpose): document messages put in the existing receipt queue use sale_reference 'DOC-...' and status 'doc_*':
--   DELETE FROM receipt_queue WHERE sale_reference LIKE 'DOC-%' AND status LIKE 'doc_%';
DROP TABLE IF EXISTS document_sends;
DROP TABLE IF EXISTS document_recipients;
DROP TABLE IF EXISTS document_quarantine;
DROP TABLE IF EXISTS documents;
