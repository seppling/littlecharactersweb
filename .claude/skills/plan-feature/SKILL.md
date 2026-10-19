---
name: plan-feature
description: "Plan a new feature or change to the site, and agree the plan with Stephen before any code"
---

# Plan a feature

This is SMB-AI's `/new-build`, adapted. This repo is one build, so each feature gets a plan file instead of a folder. Skip it only when the whole change fits in one sentence, such as fixing a typo.

1. Ask Stephen for a short name in kebab-case (lowercase words joined by hyphens, such as `camp-waitlist`).
2. If `docs/plans/<name>.md` already exists, stop and ask Stephen whether to update that plan or pick another name. Otherwise copy the template:
   `cp docs/plans/TEMPLATE.md docs/plans/<name>.md`
3. Read `docs/todo.md` and the `docs/` pages for the area the feature touches, so you ask only what isn't already decided.
4. Interview Stephen to fill in the plan. Ask one question at a time and wait for each answer. Do not guess. Cover purpose, users, what done means, how it will be checked (real situations from the business, written with made-up names, emails and phone numbers, because plans are saved in this public repo), data, approvals, decisions and out of scope. You may use the `planner` agent for this. Once the plan is filled in, delete the template's intro line ("Fill this in with Claude during `/plan-feature`...").
5. Show Stephen the plan. Stop. Do not write any code until Stephen approves the plan.
6. Once Stephen approves, commit the plan on a branch, never on `main`. If you're on `main`, start one first:
   `git switch -c feature/<name>`
   `git add docs/plans/<name>.md`
   `git commit -m "Plan: <name>"`
