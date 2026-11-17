# POS Billing: complete design pack (for ChatGPT to redesign)

**Task for ChatGPT.** Below is everything about the current POS Billing screen of Royal Bath Hub (bathroom-fittings and tiles shop, Sri Lanka): layout, every button and field, the files that style it, what is missing compared with a standard ERP/POS, and the problems the owner sees. Rearrange it into a better design: cleaner, never congested after 5 to 10 bill lines, fast for a cashier using keyboard and mouse on a small shop laptop, also usable on a phone. Return: (1) a wireframe description screen by screen, (2) the button and field list with new positions, (3) what to add, remove or merge, (4) a priority order. Do not change money rules (bill total, discount, profit, stock). Keep colours from the theme variables (light and dark).

## 1. Problems the owner reported (screenshot, 17 Nov)
- After 4 to 5 bill lines the screen is congested: the bill list, the right-hand "Bill so far" panel and the buttons row compete for the same height, and the Generate Bill button area shrinks.
- The phone box refused non-Sri Lankan numbers. Fixed 17 Nov: Sri Lankan numbers as before, and any other country when it starts with + or 00 (also "009 " with a space).
- The owner will send a picture of a real ERP POS to copy the feel from.
- Rule from the owner: one screen, no big logo strip, plain words, big touch targets (48 px), no heavy black and gold.

## 2. Layout today (top to bottom)
1. App shell bar (Home, POS, Daily Ledger, Inventory, Vendors, Sales, Banking & Money, Customers & Online, Layla, Reports, File), clock, Notepad, Refresh, Search.
2. Tabs: Bill | Quotation, and the last bill number chip ("Bill last RBH-S011").
3. Customer row: name, bill date, phone, "WhatsApp receipt" tick. Messages area ("Held bill resumed.", "No held bills.").
4. Left column: bill lines table (Item with code, Qty with - / +, Selling, Disc Rs or %, Total, remove X), then "+ Add item", Hold bill, Held (n), Scan, Bill tools drop-down.
5. Right column: "Bill so far (n items)" running list, total, Selling price (Rs) type-a-total box, Discount %, Discount Rs, live profit under the bill, payment method drop-down, Generate Bill, "Today's bills".

## 3. Every control found in public/pos_billing.html
### Buttons (26)
| id | label | click handler | class |
|---|---|---|---|
| camScanBtn | &#128247; Scan | - | tools-btn |
| toolsBtn | Bill tools &#9662; | - | tools-btn |
| holdBtn | Hold bill | holdBill() | - |
| heldBtn | Held bills (0) | toggleTool('heldPanel') | - |
| lastBtn | Last bill | openLastBill() | - |
| findBtn | Find bill | toggleTool('findPanel') | - |
| wholesaleBtn | Wholesale bill: off | - | - |
| quoteBtn | Load quotation | toggleTool('quotePanel') | - |
| clearAllBtn | Clear all test bills | clearAllBills() | - |
| - | Find | findBills() | mini-btn |
| - | + Add item | addItemRow() | add-btn |
| - | + Add payment | addSplitRow() | add-btn |
| genBtn | Generate Bill | generateBill() | generate-btn |
| cancelEditBtn | Cancel edit | resetForm() | mini-btn |
| quoteSaveBtn | Quotation (with codes) + send | - | mini-btn |
| - | &#8592; Back to POS / + New bill | resetForm() | - |
| - | Print | printBill() | share-btn print |
| waReceiptBtn | Send WhatsApp Receipt (image) | sendWhatsAppReceipt() | share-btn wa-receipt |
| voidBtn | Void this bill | - | share-btn |
| - | + New bill | resetForm() | new-bill-btn |
| - | &minus; | - | q-minus |
| - | + | - | q-plus |
| - | &times; | this.parentElement.remove() | remove-btn |
| - | (icon) | toggleBillFiles(${b.id}, this) | mini-btn |
| - | Edit | editBill(${b.id}) | mini-btn |
| - | Void | voidBill(${b.id}, '${esc(b.bill_number)}') | mini-btn danger |

### Inputs, drop-downs, text areas (15)
| tag | id | type | placeholder / label |
|---|---|---|---|
| input | customerName | text | Walk-in customer |
| input | saleDate | date | - |
| input | customerPhone | tel | e.g. 077 123 4567 |
| input | autoWa | checkbox | - |
| input | scanBox | text | Scan or type code + Enter |
| input | quoteBox | text | Filter by quote number or customer |
| input | findBox | text | Bill number, e.g. 5 or RBH-S005 |
| input | sellPrice | number | Type the agreed price |
| input | discountPct | number | - |
| input | discountAmt | number | 0 |
| select | paymentMethod | - | - |
| input | chequeRef | text | e.g. 004512 Sampath 30/10/2026 |
| input | - | text | Item name or code |
| input | - | number | Qty |
| input | - | number | Unit price |

### Main containers (ids)
formPanel, custRow, waCheck, posTools, scanMsg, toolMenu, heldPanel, quotePanel, quoteResults, findPanel, findResults, itemRows, liveBill, priceRow, saveHint, capHint, chequeBox, creditNote, splitBox, splitRows, splitHint, editBanner, errMsg, todayBox, billPanel, receipt, rShopName, rTagline, rMeta, rItems, rTotals, waReceiptMsg, billAttach

## 4. Extra modules that add or change controls at run time (public/pos-*.js)
| file | size | what it does (its own header comment) | buttons it creates |
|---|---|---|---|
| pos-camera-scan.js | 6 KB | POS phone-camera barcode scan (own module, 10 Nov 2026). Uses ZXing from the local file /lib/zxing.min.js (no CDN). iPhone Safari has no BarcodeDetector, so ZXing does the reading. It only READS a code and hands it to th | - |
| pos-cart.js | 8 KB | public/pos-cart.js * Cart logic for the POS bill page (barcode scan, quantity steps, hold / resume, totals preview). * Pure functions, no page and no network, so they are tested on their own (tests/unit/posCart.test.js). | - |
| pos-compact.js | 1 KB | POS: once the customer name / date / phone are filled and you move on, they fold into one slim line (tap it to change). | - |
| pos-customer.js | 4 KB | POS customer rules (AJ 16 Nov). Own module, wraps the page; remove the tag and the page works as before. - Blank name or "cash" with no phone = ONE shared "Walk-in customer": no new customer, no phone, no credit. - A pho | - |
| pos-draft.js | 2 KB | pos-draft.js (16 Nov audit): the POS cart survives a refresh or a closed window. Saves the unsaved bill on this device, puts it back on open, forgets it when the screen is cleared or the bill is generated. Own module: to | - |
| pos-fit.js | 2 KB | POS fit (AJ 16 Nov): Payment method and Generate Bill share one row (saves a whole row of height). Ids stay, so nothing else changes. Remove the tag to go back. | - |
| pos-flow.js | 2 KB | POS keyboard flow (AJ 16 Nov). Own module; remove the tag and the page works as before. item added (scan box, code or name) -> cursor goes to that line's Qty; Enter -> its Selling price (pos-line.js). Selling price + Ent | - |
| pos-line.js | 7 KB | POS item line (AJ 16 Nov): Item / Qty / Selling / Discount (Rs or %) / Total. Own module: wraps the page, changes none of its functions. Remove the 2 tags and the page works as before. - No Base column any more (AJ). Cos | - |
| pos-picker.js | 3 KB | public/pos-picker.js * Item picker for the POS bill page: type a name or code, pick the item from the catalogue, and its name and selling * price fill in (still editable; free-typed items are still allowed). Shows the st | - |
| pos-polish.js | 12 KB | POS polish (AJ 11 Nov 2026): wraps the bill page's own functions, changes none of them. - item rows get a Discount Rs box and column labels; the 1, 2, 3 stepper steps by whole numbers - the item list floats on top; down  | - |
| pos-profit.js | 2 KB | POS live profit (AJ 16 Nov). Own module; remove the tag and nothing else changes. Shows the profit number only (no word) under the bill, updating as he types (no Enter). Tap it to blur when a customer is looking. | - |
| pos-quote.js | 14 KB | POS: Quotation tab (same screen as billing), invoice-style quotation, hidden golden dot + live profit window. Reads the items on screen only. Never changes how a bill is saved. Cost is fetched from /api/sale-profit (owne | - |
| pos-tools.js | 2 KB | POS: no "Scan or type code" bar (AJ 16 Nov). Scan and Bill tools sit in one row with "+ Add item", under the items. Own module: remove the tag and the old bar is back. The hidden scan box stays in the page (scanner guns  | Hold bill, Held (0) |
| pos-wholesale.js | 2 KB | POS wholesale bill (AJ 16 Nov). Bill tools -> "Wholesale bill". Own module: remove the tag and the button does nothing. On: the bill is for a shop. The Selling price of every line is typed freely (wholesale price differs | - |
| pos_extra.js | 13 KB | POS extras (Ajmal 4 Nov 2026): live "bill so far" list, page layout switch, and Make quotation (with item codes) + send on WhatsApp. Reads only what is on the screen. Never changes how a bill is saved. | - |

## 5. Style and script files loaded (order matters, later wins)
CSS: /rbh-font.css, /bathhub-design.css, /bathhub-logo.css, /pos-all.css, /pos-line.css, /pos-compact.css, /pos-fit.css, /gemini-look.css, /compact-all.css, /pos-quote.css

Scripts: /rbh-early.js, /bathhub-theme.js, /bathhub-icons.js, /bathhub-a11y.js, /offline-queue.js, /pos-picker.js, /suggest.js, /pos-cart.js, /pos-draft.js, /pos-camera-scan.js, /attach-widget.js, /bathhub-logo.js, /test-banner.js, /layla-door.js, /pos_extra.js, /pos-quote.js, /pos-polish.js, /pos-line.js, /pos-customer.js, /pos-flow.js, /pos-compact.js, /pos-profit.js, /pos-tools.js, /pos-wholesale.js, /pos-fit.js

Note: many pos-*.css files patch each other with !important; one clean stylesheet would replace them.

## 6. What a standard POS has that this one is missing (from docs/AUDIT_ERP.md, POS rows 39 to 54 and 107 to 114)
| Missing or partly | Status today |
|---|---|
| Customer sales return | NOT BUILT |
| Exchange | NOT BUILT |
| Refund | NOT BUILT |
| Cashier shift open and close, opening float | NOT BUILT |
| Cash variance with reason and cashier | NOT BUILT |
| Price override with reason and approval | PARTLY (flag only) |
| Sale with stock below zero | PARTLY (allowed and logged, no approval) |
| Credit limit check at sale | PARTLY (limits stored, never checked) |
| Credit sale linked to customer ledger | PARTLY |
| Held-bills report and who held them | NOT BUILT (held bills live in the browser) |
| Cash drawer control | NOT BUILT |
| Per-cashier permissions | PARTLY |
| Journal posting for each sale | NOT BUILT |
| Day close and lock | NOT BUILT |

Already built: cash and card sale, split payment, discount cap by role, hold and resume, void with stock restore, receipt PDF and WhatsApp receipt, unique bill number, offline queue, barcode and camera scan, quotation to bill, wholesale bill switch.

## 7. Screenshot description (17 Nov, laptop screen about 1366 px wide)
A named customer, date empty (dd/mm/yyyy), an Australian +61 phone number. Three lines: Shower set (P) 1 x 33,950; FH1240S Basin tap SQ silver 1 x 6,250; 60x60 Round touch mirror 1 x 14,250. Right panel "Bill so far (9 items)" lists 073 Biday spray Leo 002 square 6,250; 069 Gully cover pop up heavy 4,250; 039 Orin ... and a total of 78,800. Selling price box "Type the agreed total", Discount % 34.64467, Discount Rs 27300 (a total typed lower than the sum). Red message: phone must be a Sri Lankan number. Payment: Cash. Buttons: + Add item, Hold bill, Held (0), Scan, Bill tools.
