# tags-skills: report

Branch `claude/bo2-tags-skills` (from `claude/blissful-archimedes-enun5m` at 3ab1c0a). No migrations. No money touched. No compaction or restart happened during this unit.

## Result

**For Hannah**
- **Settings → Tags** (a new tile): child tags and family tags, with how many carry each. She can add, rename or delete a tag. Delete asks first and takes the tag off everyone. A repeated name in other capitals is refused, and the page says why. Each tag has See who, Email and CSV/PDF.
- **Tagging:**
  - On a family's page: the family's tags and each child's. ✕ removes one; "Add a tag" lets her pick one or type a new one.
  - On a class roster: **Tag children**. She ticks children, picks or types a tag, then **Tag selected**.
- **Where tags show:** outlined chips (apart from the safety badges) on the roster, the family page and search results.
- **Filters:** the roster's **Show: Tagged …**; search by tag on `/admin/search`; **Email a tag** (the Phase 1 composer: preview, test send, copy emails and phones, send log).
- **Settings → Skills** (a new tile): each program's skills in order. She can add, rename, move up or down, retire (progress stays) and bring back.
- **Class page → Skills:** a grid of children × skills, the "Class Skills Worksheet" CSV/PDF, "Write a progress note" per child, and **Progress notes to send** (teachers' drafts).
- **Family page:** each child's **Skills and progress notes**: their skills by class, with when and by whom each was marked, plus drafts and sent notes.
- **Progress notes:** the note, with the child's Got it and Working on it skills ticked to go under it. Preview shows the email and who gets it, then Send. It goes through the existing staff email, so it's on "Emails sent".

**For teachers**
- An **Attendance · Skills** switch on a class date.
- The Skills view gives each child and skill Not yet · Working on it · Got it in one tap. Saving needs signal: offline it says "Needs signal to save", keeps the tick on screen and saves when signal returns.
- "Note for Hannah" saves a draft progress note.
- Teachers never see tags.

**For families**
- Shared progress notes appear in their account, under the child ("Mila's progress notes"), and also arrive by email.
- They never see tags or drafts.

**Files**
- **New server code:**
  - `src/server/tags.ts`
  - `src/server/skills.ts`
  - `src/server/progress-notes.ts`
- **New components:**
  - `src/components/admin/TagChips.astro`, `TagEditor.astro`, `RosterTags.astro`
  - `src/components/admin/ClassSkills.astro`, `ChildSkills.astro`, `ProgressNoteForm.astro`
  - `src/components/ProgressNotes.astro` (the family side)
- **New pages:**
  - `src/pages/admin/settings/tags/index.astro`, `[tagId].ts` (redirect), `[tagId].csv.ts`, `[tagId].pdf.ts`, `[tagId]/email.astro`
  - `src/pages/admin/settings/skills.astro`
  - `src/pages/admin/progress-notes/new.astro`, `[noteId].astro`
  - `src/pages/admin/teach/[sessionId]/[date]/skills.astro`
  - `src/pages/admin/classes/[sessionId]/tags.ts`, `skills.ts` (redirect), `skills.csv.ts`, `skills.pdf.ts`
  - `src/pages/admin/families/[householdId]/tags.ts`
  - `src/pages/api/teach/skills.ts`
- **Shared files** (lines added; nothing else changed):
  - `src/lib/admin-links.ts`: a new block at the end.
  - `src/styles/admin.css`: tag chips, skill marks, `.teach-views`.
  - The class page: the tags tools and filter, chips, the tick box, the Skills part.
  - The family page: tags and skills.
  - The account page: progress notes.
  - `search.astro`: tag picker, results and chips.
  - Settings index: two tiles.
  - The teacher attendance page: the Attendance · Skills switch only.
  - `docs/back-office.md` §21, `docs/security.md` (3 rows), `README.md` (one test line).
- **Small widening of Phase 1 email code:**
  - `message.kind` gained `'tag'` in `schema.ts` (TypeScript only; `drizzle-kit generate` reports no changes).
  - `messages.ts`: `SendInput.kind`, and `earlierMessages({ tagId })`.
  - `message-composer.ts`: `kind: 'tag'`, and `sentHere` matches non-family kinds by `sessionId`.
  - `MessageComposer.astro`: `kind !== 'family'` where it said `kind === 'class'`, plus the empty-audience wording.
- **Tests:** `tests/unit/tags-skills.test.ts` and `tests/e2e/staff-tags-skills.mjs`.

## Proof

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 37 files, 743 tests pass (33 new in `tags-skills.test.ts`). They cover:
  - names unique per kind in any case (also enforced by the table);
  - deleting a tag;
  - bulk tagging;
  - the roster, search and email-audience filters;
  - skill access: teacher, substitute on and off their date, another teacher, owner, day off, future date, turned off;
  - retired skills;
  - a teacher's draft and an owner's send (once per token);
  - tags absent from the teacher's roster, the Skills view and the family's notes.
- `npm run build`: passes.
- `npx drizzle-kit generate`: "No schema changes, nothing to migrate".
- **Browser tests:** `npm run build`, then `tests/e2e/serve.sh` on a fresh database, then every test in `README.md` in order:
  - all 17 pass: enroll 23, trial 15, editor 11, navigation 64, foundation 86, contacts 27, classes 59, families 64, payments 68, today 41, messages 46 (with SERVER_LOG), roster 48, settings 43, teach 53, calendar 52, drop-ins 49, tags-skills 71 checks.
  - It took three runs:
    - Run 1: staff-roster and staff-drop-ins failed on my 17 px "Add them in Settings → Skills" link (their 44 px tap check). Fixed by making it a button. My test also clashed with drop-ins' made-up "Quill" family name, so it now uses "Larkspur".
    - Run 2: only my test failed, on a 43.x px button. Fixed with an explicit `min-height`.
    - Run 3: all green.
- **CI:** green on every push checked; the last push's run was still in progress when I wrote this.
- **Screenshots** in `.orchestration/tags-skills/shots/`, at desktop and 390 px:
  - Settings → Tags and Skills;
  - a roster filtered by a tag; the family page with tags; search by tag;
  - the teacher's Skills view (and offline);
  - the class Skills part;
  - the progress note preview; the family's view;
  - the tag email review (desktop only).

## Decisions

1. **The tag email log.** Rows use `message.kind = 'tag'` and keep the tag id in `message.session_id`. The composer's log has to find a tag's earlier emails, and there is no other column to hold the tag. It's reversible.
2. **Drafts and skill lists.** A draft holds only the note's words. The Got it / Working on it lists are picked at send time and written into `body`, which is the text the family reads. There's no column for the picked skills, and a draft stays plain to edit.
3. **One teacher draft per teacher, child and class**, changed in place until it's sent. This avoids piles of drafts.
4. **Skill access** follows `teachAccess`'s people, but isn't tied to one date:
   - a substitute only on their date; turned off, never;
   - teachers can't tick on future dates or days off;
   - submitted or covered dates don't block ticking;
   - owners can tick any time.

   Reason: skills aren't per date ("any date it meets up to today").
5. **No fresh sign-in** for tag and skill changes or progress notes; downloads need one, as in Phase 1. These are low-risk changes, like staff notes, and they are logged.
6. **No names in addresses.** Tag redirects carry an error code (`?tagError=taken`), never a name; preview addresses carry skill ids only.
7. **Who-did-it names.** "By whom" uses the name in Settings → Staff when there is one, because teachers' accounts often have no name.
8. **A retired skill** leaves the grid and the teacher's list, and stays on the family page where a child has progress. "Bring back" puts it at the end.
9. **Tag names are labels.** The add form says "Keep medical details out of tags", and audit entries hold ids only.

## Open points

- **Should teachers see tags such as a cast group or a level?** Recommended: no, as now. The prompt says staff only, and the shows unit has its own cast list.
- **Should a progress note's email name the teacher?** Recommended: no for now. It comes from Little Characters, and Hannah can add a line herself.
- **Should Hannah be able to edit a note after sending it?** Recommended: no. The family already has the email; she can send another note.

## Follow-up candidates

- A "Skills" filter on the teacher's view: one skill for every child, for when a class works on one thing.
- A count of progress notes to send on Today / Needs attention.
- Tags as a filter on the Classes list and in Reports (e.g. "children tagged Scholarship by class").
- Merging two tags.

## Handoff

- **Routes and link functions** are in `docs/back-office.md` §21: `settingsTags`, `tagList`, `tagEmail`, `searchTag`, `familyTags`, `classTags`, `settingsSkills`, `classSkills`, `teachSkills`, `progressNote`, `newProgressNote`.
- **Tags** (`src/server/tags.ts`):
  - `listTags()` → `TagRow { id, name, kind, count }[]`;
  - `tagsForStudents(ids)` and `tagsForHouseholds(ids)` → `Map<id, { id, name }[]>`;
  - `tagMembers(tag, catalog)` → `{ kind: 'child', children }` or `{ kind: 'family', families }`;
  - `tagAudience(tag)` → `AudienceFamily[]`;
  - `withTag(rows, map, tagId)` (pure).
- **Skills** (`src/server/skills.ts`):
  - `programSkills(slug, { retired })`;
  - `skillAccess` (pure) and `skillDateFor`;
  - `skillRoster`, `setSkill` (`POST /api/teach/skills`);
  - `classSkillGrid`, `skillGridTable`, `skillGridPdf`;
  - `childSkills(ids, catalog)` → `Map<studentId, ChildSkillClass[]>`.
- **Progress notes** (`src/server/progress-notes.ts`):
  - `saveDraft`, `saveTeacherDraft`, `draftsForClass`, `notesForStudents`;
  - `skillChoices`, `previewNote`, `sendProgressNote` (through `sendMessage`, kind `family`);
  - `sharedNotesFor(householdId)` for the account page.
- **Email:** `MessageComposer` and `composerStep` take `kind: 'tag'`, with the tag id as `sessionId`. Any later "email a group" can reuse this.
- **Audit actions:**
  - `admin.tag.create|rename|delete|add|remove`;
  - `admin.skill.add|rename|move|retire|reactivate`;
  - `teach.skills.view`, `teach.skill.change`;
  - `teach.progress_note.draft`, `admin.progress_note.draft|edit|delete|send`;
  - downloads use list ids `tag:<id>` and `skills:<sessionId>`.
- **Merge notes:**
  - `docs/back-office.md`: my section is §21 (after §20).
  - The class page: three lines in the roster (the `RosterTags` component, `shownKids.map`, `TagChips` in the summary), a tick box in `kid__actions`, and `<ClassSkills>` before the Waitlist.
  - The family page: a Tags section after the notices, and `TagEditor` + `ChildSkills` in each child card.

## Compaction

None occurred.
