# Wording drafts

New wording for the site (search titles and descriptions, clearer class descriptions, new FAQs) is written as **drafts**. A draft never changes the site by itself. It goes into the content editor as *unpublished changes*, and today's wording stays live until Hannah publishes the new one.

- The drafts: `src/content/seo-draft/` (one file per kind of content)
- Every change, before → after, with its reason: [review.md](review.md)

## Part 1: the format, for whoever writes drafts

Add drafts to the file for their kind: `pages.ts`, `programs.ts` (classes, camps, workshops, lessons and parties), `events.ts`, `faqs.ts`, `team.ts`, `testimonials.ts`, `locations.ts`. Each file exports one list.

### Changing an entry that's on the site

```ts
// src/content/seo-draft/pages.ts
import type { PageDraft } from './format';

export const pages: PageDraft[] = [
  {
    kind: 'pages',
    id: 'home',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Kids’ Theater Classes in Athens, GA | Little Characters',
        why: 'Says what we offer and where, in the words parents search for.',
      },
      {
        path: 'callSheet.items.0.text',
        from: 'New to Little Characters? Your first class is free.',
        to: 'New to Little Characters? Your first class is free, ages 4 and up.',
        why: 'Puts the ages where families look first.',
      },
    ],
  },
];
```

```ts
// src/content/seo-draft/programs.ts
import type { CollectionDraft } from './format';

export const programs: CollectionDraft<'programs'>[] = [
  {
    kind: 'programs',
    id: 'intro-to-theater',
    edits: [{ path: 'description.0', from: '…the first paragraph, exactly…', to: '…', why: '…' }],
  },
];
```

- **`kind`**: `pages`, `programs`, `events`, `faqs`, `team`, `testimonials` or `locations`.
- **`id`**: the end of the entry's editor address, `/admin/content/<kind>/<id>`. Pages: `site`, `home`, `about`, `team` (/about/team), `schools` (/about/schools), `camps`, `geode`, `give`, `contact`, `faq`, `classes` (the class finder), `events` (the keys in `src/content/pages.ts`). Classes and events: their web address (`slug`). FAQs, team and testimonials: the id in the seed (`slugify` of the question, name or first name).
- **`path`**: field keys joined by dots, as defined in `src/content/collections.ts` and `src/content/pages.ts`. A number picks a list item, counting from 0:
  - `seo.title`: a field inside a group
  - `callSheet.items.2.text`: a field in the third card of a list
  - `description.0`: the first paragraph of a *paragraphs* field (`lines` fields work the same way)
  - `image.alt`: a photo's description
  
  A path must end at one field. A group, a whole list item or a whole photo is refused.
- **`from`**: exactly what the field holds now, character for character (curly quotes, `**bold**`, `[links](/x)` and `{email}` included). Use `''` when it's empty. This is the safety check: if anyone changes the field before the draft is loaded, the draft is skipped instead of overwriting their change. For a whole `paragraphs` or `lines` field, `from` and `to` are lists of strings.
- **`to`**: the new text. `''` empties the field.
- **`why`**: one sentence for Hannah: what this helps and why.

Write in the site's voice and keep to facts the site or Hannah already state. Put each change for one entry in one draft; two edits to the same path are refused. Text limits are the editor's: an SEO title up to 70 characters, a description up to 300.

### A new entry

```ts
// src/content/seo-draft/faqs.ts
import type { CollectionDraft } from './format';

export const faqs: CollectionDraft<'faqs'>[] = [
  {
    kind: 'faqs',
    create: { group: 'Getting started', q: 'Do you offer theater classes for toddlers?', a: '…' },
    why: 'Parents search for this, and the answer isn’t on the site yet.',
  },
];
```

`create` holds every field of the new entry, as the editor would save it. It's added as *Not published yet*. If an entry with the same id or the same title (question, name…) is already in the editor, it's left alone.

### Checking your drafts

```sh
npm test               # each draft must apply to the starting content and pass the editor's checks
npm run seo:review     # rewrite docs/seo/review.md; commit it with the drafts (a test checks it's current)
npm run seo:load-drafts   # dry run against your local database: what would be loaded or skipped
```

The test `tests/unit/seo-drafts.test.ts` loads each draft against a fresh copy of the starting content (`src/content/seed/`), so every `from` has to match the seed exactly. If a draft fails, the test says which field and what it reads now.

## Part 2: for Hannah and Stephen

### How drafts get into the editor

- **On the preview site** (Render), the drafts are loaded each time the preview is built. Open the editor there to review them. The preview starts from scratch on each deploy, so what you publish there is a rehearsal, not the real site.
- **At launch** (or any time on the real site), Stephen runs:

  ```sh
  npm run seo:load-drafts             # shows what it would do; writes nothing
  npm run seo:load-drafts -- --commit # saves them as unpublished drafts
  ```

  It never publishes. It skips, and says why:
  - anything that already has unpublished changes (your work in progress is never touched);
  - any field that's been changed since the draft was written (it names the field and what it says now);
  - anything the editor would refuse (too long, a required field left empty).

  Running it again changes nothing. One thing to know: if you **discard** a loaded draft and Stephen runs the command again, that draft comes back, because the site still says what it said. Remove a draft you don't want from the draft files instead (or tell whoever maintains them).

The database records the saver of these drafts as `seo-drafts`, not as a person. When you publish one, the history records you.

### Reviewing a draft

Each page, class or question with a draft shows **Unpublished changes** in the editor (new questions show **Not published yet**). [review.md](review.md) lists every change with its reason and its editor link.

1. Open the editor link (for example `/admin/content/pages/home`). The form shows the new wording.
2. Press **Preview** to see the real page with the new wording, just for you. The purple bar's **Back to editing** returns to the form.
3. Then:
   - **Publish** puts the new wording on the site.
   - **Discard unpublished changes** throws the draft away; the site keeps today's wording. For a new question, discarding removes it.
   - Or change the wording in the form first, then **Save draft** or **Publish**.

Changed your mind after publishing? **History and older versions** brings back the earlier wording (see [the editor guide](../content-editor.md)).
