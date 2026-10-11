# Loader unit: report

## Result

What it does: wording drafts live in `src/content/seo-draft/`. `npm run seo:load-drafts` saves each one in the content editor as an **unpublished draft**, through `saveDraft` (the editor's own save, with its checks). It never publishes. The public site keeps today's wording until Hannah publishes. To take a loaded draft back, use **Discard unpublished changes** in the editor (for a new entry, that removes it).

How to run it:
```sh
npm run seo:load-drafts                       # dry run: what would be loaded or skipped (writes nothing)
npm run seo:load-drafts -- --commit           # save as unpublished drafts
npm run seo:load-drafts -- --from file.ts     # take drafts from another file (exports `drafts`), to try it out
npm run seo:review                            # rewrite docs/seo/review.md from the drafts
```

By file:
- `src/content/seo-draft/format.ts`: the format (`EntryDraft` with `edits: {path, from, to, why}[]`, `NewEntryDraft` with `create` + `why`), path checking against the field definitions (`resolvePath`), and `applyEdits`. It names no field: paths are checked against `collections.ts` / `pages.ts`, so the `seo` group the other session adds to programs works with no change here.
- `src/content/seo-draft/{pages,programs,events,faqs,team,testimonials,locations}.ts`: one list for each kind, all empty.
- `src/content/seo-draft/index.ts`: `drafts`, all the lists in order, plus a re-export of the format.
- `src/content/seo-draft/review.ts`: builds `docs/seo/review.md` (editor link, then before → after with the reason for each change; new entries field by field).
- `scripts/seo-drafts.ts`: `loadDrafts(drafts, { commit })` and `describeOutcomes`, which prints the result in plain words. For each entry it does this:
  - skips it if it already has a draft (says so);
  - skips it if it isn't in the editor, or isn't published;
  - skips it if any `from` no longer matches what's published, naming the field and what it says now;
  - reports a bad path as a problem;
  - reports "nothing to change" if the result equals what's published;
  - otherwise runs `prepare` (dry run) or `saveDraft` (`--commit`).
  
  New entries are skipped when an entry with the same id or title exists.
- `scripts/seo-load-drafts.ts`: the command line. It exits with 1 when a draft has a problem.
- `scripts/seo-review.ts`: writes `docs/seo/review.md`.
- `scripts/prepare-preview-db.ts`: after seeding, loads the drafts with `--commit` behavior, so the Render preview's editor shows them. Errors from the loader are no longer reported as the "snapshot did not open" message.
- `package.json`: adds the `seo:load-drafts` and `seo:review` scripts.
- `tests/unit/seo-drafts.test.ts`: 14 tests (below).
- `docs/seo/drafts.md`: the format for the wording sessions, then a plain-words guide for Hannah and Stephen.
- `docs/seo/review.md`: generated, and says "no drafts yet" for now.

## Proof

- `npm run check`: 0 errors, 0 warnings (6 hints, all in existing files).
- `npm test`: 7 files, 171 tests passed (14 of them new, in `tests/unit/seo-drafts.test.ts`). The new tests prove these points, each against the in-memory database:
  - a dry run writes nothing (the whole `content_entry` and `content_version` tables compared before and after);
  - `--commit` adds **no** `content_version` row (nothing published); every `published` column is unchanged; `getContent('live')` is unchanged; the draft shows in `getContent('draft')`; `updated_by = 'seo-drafts'` and `published_by` is null;
  - a new FAQ is created with `published = null` (status "new") and isn't on the live site;
  - a second run gives `skipped` for both and leaves the tables exactly as they were;
  - an entry with Hannah's unpublished draft is skipped, and her draft and `updated_by` are unchanged;
  - after Hannah publishes a new class summary, a draft written against the old one is skipped with the message "summary (Summary) has changed since the draft was written. It now reads: “Hannah rewrote this.”" No draft is created;
  - a draft the editor would refuse (an SEO title over 70 characters) is reported, and nothing is saved;
  - a wrong id or a misspelled path is reported in plain words;
  - every text field in every seed entry, across all collections and pages, including fields inside list items, can be edited by its path alone (more than 200 fields);
  - each draft in `src/content/seo-draft/` applies to the seed and passes `prepare` (an `it.each`; with no drafts yet it makes no tests);
  - `docs/seo/review.md` equals `renderReview(drafts)`.
- `npm run build`: complete.
- Real run: a temporary draft outside the repository (scratchpad `try-drafts.ts`: home `seo.title` from '' and `callSheet.items.0.text`), on a fresh local database `.data/seo-try`:
  - dry run: "Ready to load (1) Home page /admin/content/pages/home", exit 0;
  - `--commit`: "Saved as unpublished drafts (1)… Nothing was published.";
  - second `--commit`: "Skipped (1)… It already has unpublished changes, so it was left alone."
  
  Then I started the built server on that database and checked it with Playwright (fetch for the public page):
  - the public `/` still shows "New to Little Characters? Your first class is free." and its title is "Little Characters Theater Troupe · Athens, GA";
  - signed in as hannah@example.com, the editor at `/admin/content/pages/home` shows Status **Unpublished changes**, and the SEO title field holds the draft;
  - **Preview** shows the purple preview bar, the draft text "DRAFT TEST: your first class is free.", and the title "Kids theater classes in Athens, GA (draft test) · Little Characters";
  - the public page still has the old wording after the preview. I checked a screenshot of the preview.
- Browser tests: `npm run build && tests/e2e/serve.sh`, then `node tests/e2e/enroll-journey.mjs` ("All journey checks passed."), then `node tests/e2e/content-editor.mjs` ("All editor checks passed.").
- `npm run db:prepare-preview`, with `APP_ENV=development PGLITE_DIR=.data/ci-preview` as in CI:
  - no drafts (as committed): peak memory **366 MB**;
  - with 3 temporary page drafts: **369 MB**, with all 3 saved;
  - re-run on the same database: 296 MB, all skipped.
  
  For comparison, the base branch's script measures 348 MB on this machine. All runs are under the 450 MB limit. The temporary drafts were removed and not committed.
- CI: see the last section, checked after the push.

## Decisions

- **Who saved the draft:** `content_entry.updated_by` is a free text column with no link to the user table, and saving a draft writes no `content_version` row. So the loader saves with `updated_by = 'seo-drafts'`. It isn't an account and can't sign in. When Hannah publishes, `content_version.user_id` records her. Reason: this uses what the tables already record, without a fake user row. (The editor doesn't show `updated_by` today: see Open points.)
- **"Empty" is one thing:** `from: ''` matches a field that's missing, `''` or an empty list. `to: ''` removes the field, and any group it leaves empty, the way the editor's form does. Reason: drafts are easy to write by hand, and an unchanged entry stays identical to what the editor would save.
- **Paths are dotted keys with numeric list indexes**, checked against the field definitions. A path must end at one field (also one paragraph or line, or a photo detail like `image.alt`). Reason: it's the editor's own error-path notation (`sessions.1.start`), and it's short. If cards are reordered, the `from` check catches it.
- **Problem vs skipped:** a mistake in the draft (bad path, missing list item, two edits to one path, refused by the editor) is a *problem*: exit code 1, and the test fails. A field changed since the draft was written is *skipped*. Reason: the first needs the draft fixed; the second is the safety rule working.
- **Skip the whole entry if any `from` fails.** No partial drafts. Reason: it's simpler, and Hannah reviews one coherent change per page.
- **New entries are matched by id or title** for idempotence, because collections without an id field generate ids (with a random suffix on a clash).
- **The dry run validates with `prepare`**, the same checks `saveDraft` runs, without writing anything.
- **No change to `src/server/content.ts`.**
- **Preview:** the loader runs after `getContent()` in `prepare-preview-db.ts`, outside the "snapshot did not open" try block, so a loader error isn't mislabeled. It prints the outcome only when there are drafts, so the CI log is unchanged for now.
- **`--from <file>`** lets you try the loader with drafts from a file outside the repository. I used it for the real run.

## Open points

1. **A discarded draft comes back on a re-run.** If Hannah discards a loaded draft and someone runs `--commit` again, it's loaded again, because the field still matches `from`. On the preview this doesn't matter (a fresh database each deploy). *Recommended:* run the loader once on the real database at launch, and remove rejected drafts from the files. That's what `docs/seo/drafts.md` says. If that isn't enough, a later change could record loaded drafts (that would need a table or a `content_version` action, which is outside this unit).
2. **The editor doesn't show who saved a draft.** It shows only "Draft saved <time>". *Recommended:* a small editor change, later and outside this unit, to show "Draft saved by seo-drafts" when `updated_by` isn't a user. Until then, review.md and the Unpublished changes status make the source clear.
3. **A small race:** if Hannah saves a draft between the loader's check and its save (milliseconds), the loader's save would replace hers. `saveDraft` has no "only if no draft" condition. *Recommended:* accept it (run when nobody is editing, say at launch). Otherwise add an optional `ifNoDraft` guard to `saveDraft`, which would mean changing `src/server/content.ts`.

## Follow-up candidates

- Show `updated_by` for drafts in the editor's status box (Open point 2).
- Have `scripts/seo-load-drafts.ts` print the review.md path, or open it, after `--commit`.

## Handoff (for the wording sessions)

- Write drafts in `src/content/seo-draft/<kind>.ts` (`pages.ts`, `programs.ts`, `events.ts`, `faqs.ts`, …). The exact format, with examples, is in `docs/seo/drafts.md` Part 1. Summary:
  ```ts
  { kind: 'pages', id: 'home', edits: [{ path: 'seo.title', from: '', to: '…', why: '…' }] }
  { kind: 'programs', id: '<slug>', edits: [{ path: 'description.0', from: '<exact current paragraph>', to: '…', why: '…' }] }
  { kind: 'faqs', create: { group: 'Getting started', q: '…', a: '…' }, why: '…' }
  ```
  Page ids are `site, home, about, camps, geode, give, contact, faq, classes, events`. Each `from` must equal the seed text exactly (curly quotes and markup included); use `''` for an empty field.
- Check your drafts with `npm test` (`tests/unit/seo-drafts.test.ts` applies each one to the seed and runs the editor's checks), then `npm run seo:review`, and commit `docs/seo/review.md` with the drafts. A test fails if it's out of date.
- The programs `seo` group from the technical session needs no loader change. Once it's in `collections.ts`, `path: 'seo.title'` on a program works. Until it's merged, a program `seo.*` draft fails the test with "there is no field “seo”".
- When two drafts edit the same entry, keep them as one draft (one object, several edits). A second draft for the same entry would be skipped once the first is loaded.

## Compaction

No compaction or restart happened in this session.
