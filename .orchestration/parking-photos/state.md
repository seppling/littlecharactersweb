# parking-photos: state

**Branch:** `claude/seo-parking-photos` (from `claude/seo-draft`)
**Status:** done; report in `report.md`. Waiting on CI for the pushed commit.

## Commits
- Parking maps on the Contact page, PDF redirects, share photo for search fields (this commit).

## Decisions
- Maps cropped from the PDF pages rendered at 186 dpi (the embedded photos' own resolution) so the star and arrows drawn on top are kept. Saved as WebP in `src/assets/photos/`.
- "Full size" = the largest built size (960 px wide; the crops are 1184 px). A plain link to the image, no lightbox script: works without JS and phones can pinch-zoom.
- Both drop-off details go in one edit of `parking.dropOff` (one path per draft).
- The maps are in the `photos` folder, so the build also makes their share images (22 small JPEGs). Left as is: simpler, and lets Hannah pick a map as a share photo.

## Open questions
- None blocking. See report → Open points.

## Next action
- None for this unit. Coordinator merges into `claude/seo-draft`.
