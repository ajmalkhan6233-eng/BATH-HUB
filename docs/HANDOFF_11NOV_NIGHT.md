# HANDOFF 11 Nov 2026 night (read this first, then LIVE.md top 6 lines)
Reply rules: start "AJ,"; one line next step; NEEDS YOUR ATTENTION block only if he has an action; DONE / NOT DONE one line each; "heads-up" never "problems"; end with status word.

## On the shop PC (waiting for "check bridge", bridge repo main)
- TASK 190 POS space (+SW v94-a, build stamp), TASK 192 POS look (SW v94-b, stamp "Build 11 Nov 20:35 · POS look").
- TASK 193 = replay of 191: Fazal split + 6 cheques. 191 was BLOCKED: shop DB spells the vendor FAZAAL, script now matches (regex "faz"). Backup from 20:19 exists. PC must `git pull` the bridge first.
- Script: scripts/split_vendor_fazal.js (dry run default, --apply, --undo). Fazaal keeps G1CR008312 (474,000); 3 bills (cash memos 46221-46223, 1,389,625) go to "Fawaz (Fazaal Hardware Pvt Ltd)"; 6 HNB cheques to cheque_register: 704927 04 Feb 150k, 704930 11 Feb 150k, 704931 18 Feb 300k, 704929 26 Feb 300k, 704926 05 Mar 150k (date overwritten, check bank), 704928 12 Mar 300k. Total 1,350,000 vs bills 1,863,625: 513,625 not covered. No bill marked paid; AJ must say which cheque pays which bill. No bank account number stored.
- Earlier tasks 186-189 ran (UNVERIFIED in browser).

## Open
- Gemini POS design: its full code never reached chat (older whole-app Gemini files in uploads are not it). Chat built its own POS look instead; if AJ pastes Gemini's full code, compare and preview first.
- AJ's real names: new vendor rep name later. Sheet "Fazal split and 6 cheques" (Sheets artifact) still spells Fazal once-A.
- AJ's rule: item list stays BELOW its box, short soft slide; right side calm; no bouncing.
- Unverified on real PC: POS look/space, GRN small boxes, customer dropdown, shell-fit, item edit box vendor, Down-arrow list.
- Later: Pocket Cloudflare setup, receipt layout after printer, reorder minimums, backup passphrase, Google Maps listing. PR #2 on master stays unmerged (work is the shop branch).

## Heads of branches
work f305afa (POS look) + later fix 237cacb is bridge main. Never push master.
