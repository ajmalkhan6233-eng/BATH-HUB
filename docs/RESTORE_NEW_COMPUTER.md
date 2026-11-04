# New computer: get the whole shop app back
STATUS (4 Nov 2026): the backup script is BUILT and TESTED on a copy, but NOT switched on to run by itself yet (see "Switch on").
It saves to branch `rbh-backup` of a PRIVATE GitHub repo (the bridge repo Universal-project-): database dump, whole app code, .env, uploads, data, drafts_inbox, config.
It REFUSES to push if the repo can be read without signing in (public), or if it cannot check. The app repo BATH-HUB is PUBLIC, so it is never the target.

## Run one backup now (PC)
`node scripts/pc/github_backup.js --force`   (result line also in logs/github_backup.json)

## Switch on "about every hour"
Run `node scripts/pc/github_backup.js --tick` from the 5-minute watchdog or a Windows scheduled task. `--tick` skips itself if a good backup is under 55 minutes old.

## On the new computer, tell Claude Code exactly this
"Restore the Royal Bath Hub app from my private GitHub backup. Repo Universal-project-, branch rbh-backup. Follow docs/RESTORE_NEW_COMPUTER.md (it is inside the backup at code/docs/). Install Node, PostgreSQL and pm2 if missing."

## What Claude Code does
1. `git clone -b rbh-backup <private repo url> RBH_FullBackup` (sign in to GitHub once).
2. Install Node LTS, PostgreSQL, pm2. Create the empty database and user named in files/.env (DB_NAME, DB_USER, DB_PASSWORD).
3. `node RBH_FullBackup/code/scripts/pc/restore_from_backup.js RBH_FullBackup <app folder>` (copies code + data, loads the dump).
4. In the app folder: `npm install`, `pm2 start server.js --name apex-server`, open http://localhost:3100/health.
Daily copies of the last 14 days sit in db/daily/ if the newest dump is bad.
