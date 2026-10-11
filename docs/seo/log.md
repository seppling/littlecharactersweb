# SEO draft: plan and log

The record of the SEO and local-discoverability draft for littlecharacters.org. Each piece of work is done by a separate Claude session on its own branch, and is merged into `claude/seo-draft` once it's checked.

## What was asked

Optimize the existing site content for search and for discoverability in Athens, GA, without overwriting the current wording. The draft stays separate.

## Decisions (October 11, 2026)

- **The draft stays separate in two ways.** All the work is on the `claude/seo-draft` branch, outside the content-editor pull request. New wording goes into the content editor as unpublished drafts, so Hannah previews each page and publishes only what she likes. Today's wording stays live until she does.
- **Two parts, with a stop after each.** Part 1 builds the research and the groundwork. Part 2 writes the wording.
- **In scope:** search research, the behind-the-scenes Google setup, wording drafts, and a Google Business Profile kit (added later the same day).
- **Small wording and technical choices** are settled during the work and noted here. Any claim (such as "Athens' only…", the towns served, prices or awards) goes to Stephen and Hannah.
- **At most three sessions run at once.**

## Plan

| # | Unit | Part | Needs | Branch |
|---|---|---|---|---|
| 1 | Search research: what Athens parents search for, who ranks, a page-by-page target list | 1 | — | `claude/seo-research` |
| 2 | Google setup: search fields for classes and events, place in page titles, share previews, event and business details, redirects from old addresses | 1 | — | `claude/seo-google-setup` |
| 3 | Draft loader: puts new wording into the editor as unpublished drafts, never over newer edits | 1 | — | `claude/seo-loader` |
| 4 | Wording drafts for the site pages | 2 | 1, 2, 3 | `claude/seo-copy-pages` |
| 5 | Wording drafts for classes, camps, events and FAQs | 2 | 1, 2, 3 | `claude/seo-copy-classes` |
| 6 | Google Business Profile kit: profile description, categories, services, listings to claim, review-request message | 2 | 1 | `claude/seo-business-profile` |

## Log

Each merged unit gets an entry here: what changed, the proof, the decisions, follow-up work and notes for later units.
