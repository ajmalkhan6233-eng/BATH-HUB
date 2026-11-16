#!/usr/bin/env python3
"""RBH screen-flow checks 10-16 (test copy only, port 3199). Run: python3 scripts/qa/rbh_flows.py. Prints PASS/FAIL per step."""
import asyncio, sys
from playwright.async_api import async_playwright
B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3199"
F = 0
def r(ok, name):
    global F
    print(("PASS " if ok else "FAIL ") + name)
    if not ok: F += 1
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        # 10-13: each money screen opens, draws its form, no script errors (data steps are done by the owner-side API checks)
        for step, name, url, sel in [("10", "GRN screen", "/grn_workbench.html?embed=1", "#grnbar"), ("11", "POS screen", "/pos_billing.html?embed=1", "input"), ("12", "POS bill date box", "/pos_billing.html?embed=1", "input[type=date]"), ("13", "Cheque register", "/cheque_register.html?embed=1", "table, .box, main")]:
            pg = await b.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:100]))
            await pg.goto(B + url, wait_until="load"); await pg.wait_for_timeout(2000)
            r(await pg.locator(sel).count() > 0 and not errs, f"{step} {name} opens ({errs[:1]})")
            await pg.close()
        # 14 ledger: take fixed cost from till twice
        pg = await b.new_page(); await pg.goto(B + "/daily-entry-v2.html?embed=1", wait_until="load"); await pg.wait_for_timeout(1200)
        await pg.evaluate("window.goTab('exp')"); await pg.wait_for_timeout(500)
        has = await pg.locator("#fixedBar").count() > 0
        r(has, "14a ledger has Fixed costs bar")
        if has:
            await pg.fill("#fxDay", "5000"); await pg.click("#fxTake"); await pg.wait_for_timeout(600)
            rows = await pg.locator("#payBody tr").evaluate_all("els=>els.filter(e=>/Fixed costs/.test(e.innerText||[...e.querySelectorAll('input')].map(i=>i.value).join(' '))).length")
            vals = await pg.locator("#payBody input").evaluate_all("els=>els.map(e=>e.value).join('|')")
            r("Fixed costs" in vals, "14b payout row added")
            await pg.click("#fxTake"); await pg.wait_for_timeout(500)
            vals2 = await pg.locator("#payBody input").evaluate_all("els=>els.map(e=>e.value).join('|')")
            r(vals2.count("Fixed costs") == 1, "14c second tap does not add again")
        await pg.close()
        # 15 Enter moves to next box (customers credit card, opened inside the owner shell like a real user)
        pg = await b.new_page(); await pg.goto(B + "/owner#/customers", wait_until="load"); await pg.wait_for_timeout(3500)
        fr = next((f for f in pg.frames if f.url.endswith("customers.html")), None)
        if fr is None: r(False, "15 customers screen opens")
        else:
            await fr.focus("#cr_n"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(200)
            r(await fr.evaluate("document.activeElement&&document.activeElement.id") == "cr_l", "15 Enter jumps to next box")
        await pg.close()
        # 16 Home stays still
        pg = await b.new_page(); await pg.goto(B + "/owner", wait_until="load"); await pg.wait_for_timeout(2500)
        t1 = await pg.evaluate("document.getElementById('page-dashboard').innerText"); await pg.wait_for_timeout(5000)
        t2 = await pg.evaluate("document.getElementById('page-dashboard').innerText")
        r(t1 == t2 and len(t1) > 50, "16 Home numbers do not change by themselves")
        await b.close()
    print("GREEN" if F == 0 else f"BLOCKED: {F} failed")
asyncio.run(main())
