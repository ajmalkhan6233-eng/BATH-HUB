# Bill photo reader (Gemini Vision) - prompt and response schema
Written 22 Oct 2026 with Gemini. NOT wired into the app yet and NOT tested on a real bill. Send ALL pages of one bill in ONE request (up to 4 images). The paper payment method is only a hint; the owner's WhatsApp caption decides it.

## Prompt
```text
You are an expert OCR and data extraction assistant for Royal Bath Hub (bathroom accessories shop in Sri Lanka). 
Analyze the provided image(s) of a multi-page handwritten or typed bill/invoice (up to 4 images max sent in a single request). 
Merge all line items, bill numbers, totals, and details across all provided image pages into a single unified JSON output.

Strict Rules:
1. NEVER guess or fabricate numbers, item codes, prices, or names. If unreadable, blurred, or missing, set to null.
2. Ignore and exclude any crossed-out items, crossed-out numbers, or voided lines entirely.
3. Arithmetic Check: Verify line totals (qty x unit_price vs line amount) and overall subtotal/discount reconciliation against the stated paper total. Populate `verification_flags` if discrepancies or mathematical mismatches occur.
4. Phone Rule: Evaluate phone number digit clarity. If digits are smudged, incomplete, or uncertain, set `phone_confidence` to "low" or "none" (and leave `customer_phone` null if unreadable).
5. payment_method must be null if not explicitly written on the paper (AJ's WhatsApp caption determines the final payment method).
6. Multi-page merge: Combine all items from all page images into the single items array.

```

## responseSchema (Gemini API format)
```json
{
  "responseSchema": {
    "type": "OBJECT",
    "properties": {
      "bill_number": { "type": "STRING", "nullable": true },
      "date": { "type": "STRING", "nullable": true },
      "customer_name": { "type": "STRING", "nullable": true },
      "customer_phone": { "type": "STRING", "nullable": true },
      "payment_method": { "type": "STRING", "enum": ["cash", "card", "online", "cheque", "credit", "split"], "nullable": true },
      "items": {
        "type": "ARRAY",
        "items": {
          "type": "OBJECT",
          "properties": {
            "code": { "type": "STRING", "nullable": true },
            "name": { "type": "STRING" },
            "qty": { "type": "NUMBER" },
            "unit_price": { "type": "NUMBER", "nullable": true },
            "amount": { "type": "NUMBER", "nullable": true },
            "confidence_flag": { "type": "STRING", "enum": ["high", "medium", "low"] }
          },
          "required": ["name", "qty", "confidence_flag"]
        }
      },
      "discount": { "type": "NUMBER", "nullable": true },
      "bill_total_written": { "type": "NUMBER", "nullable": true },
      "total": { "type": "NUMBER", "nullable": true },
      "phone_confidence": { "type": "STRING", "enum": ["high", "medium", "low", "none"] },
      "verification_flags": {
        "type": "ARRAY",
        "items": { "type": "STRING" }
      }
    },
    "required": ["items", "verification_flags", "phone_confidence"]
  }
}

```
