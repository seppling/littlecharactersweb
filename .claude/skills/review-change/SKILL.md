---
name: review-change
description: "Check a change against the foundation and playbook before Stephen approves it"
---

# Review a change

This is SMB-AI's `/review-change`, adapted. Run it before asking Stephen to approve any change.

1. Run the main checks CI runs, and note what each printed:
   - `npm run check`
   - `npm test`
   - `npm run build`

   If the change touches pages, the portal or the back office, also run the browser tests that cover it (the list and order are in `README.md`, under "Run it"). CI on the pull request also starts the billing and import scripts and checks the preview database. Check that CI passed before Stephen merges.
2. Dispatch the reviewer agent: use the Agent tool with the `reviewer` subagent. Run `git fetch origin main` and `git diff origin/main...HEAD` yourself and give the reviewer that diff, because the reviewer can read files but cannot run commands. Point it to the change's plan in `docs/plans/`, or to `docs/todo.md` when there is no plan.
3. Check these yourself:
   - The diff holds no secrets and no real family data: no keys, nothing from `.env`, and no names, emails or phone numbers from `imports/` or `.data/`.
   - Every part about money, families, deleting data or going live is named, so Stephen reads it in full. That includes prices and billing, emails to families, new files in `drizzle/` (database migrations, which run on every deploy), and changes to `render.production.yaml` or `.github/workflows/` (the live site's hosting, and the daily autopay run).
   - `CLAUDE.md` is still under 150 lines: `wc -l CLAUDE.md`.
   - `FOUNDATION.md` and the copied pages in `playbook/` are unchanged, unless the change is a fresh copy from SMB-AI.
4. Report the blocking findings first, in plain English, then the optional ones. Say whether each check passed. Name the file and line for each finding.
