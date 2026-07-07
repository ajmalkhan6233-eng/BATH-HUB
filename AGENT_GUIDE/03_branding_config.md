# Branding — one config file controls identity

File: config/active.branding.json
Fields: company_name, legal_name, tagline, logo_url, currency, currency_symbol,
        locale, theme (color palette), watermark_text, db_name, support_contact{name,phone,email}.

- The frontend fetches it from GET /api/branding at load; changes show after server restart + refresh.
- Logo file lives in public/vendor/ ; logo_url is its web path (e.g. /vendor/logo.png).
- To rebrand a client copy: edit this ONE file (+ replace the logo file). Do not
  hardcode the business name anywhere in HTML or JS — always read it from BRAND (frontend)
  or the config file (backend).
- config/default.branding.json is the pristine template — never edit it on a client machine.
