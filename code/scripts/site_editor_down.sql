-- REVERSE of the website editor: removes only its two new tables (nothing else is touched).
-- Also delete the folder uploads/site/ if you want the photos gone.
DROP TABLE IF EXISTS site_tiles;
DROP TABLE IF EXISTS site_text;
