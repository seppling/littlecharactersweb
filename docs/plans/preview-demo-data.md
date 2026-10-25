# Plan: preview-demo-data

## Purpose

The Render preview (https://littlecharacters-preview.onrender.com) starts empty, so the back office has nothing to show: no families, no payments, no attendance, and blank reports. This change fills the preview with made-up families and a few months of made-up activity, so Stephen and Hannah can click through every staff page, the teacher app and the reports as if the studio were running.

## Who uses it

- Stephen and Hannah, to review the back office before launch.
- Anyone they share the preview link with, such as a teacher trying the phone app.

## What "done" means

After each deploy, and each time the preview wakes from sleep, it has:

- **People to sign in as.** All addresses are made up, and the codes appear at `/dev/mailbox`:
  - an owner, `owner@example.com` (Hannah's view);
  - two teachers, `teacher@example.com` and `teacher2@example.com`;
  - a parent, `parent@example.com` (a family's view).
- **Families.** About 25 made-up families with about 35 children across the Fall 2026 classes. Each family has contact details, emergency contacts and pickup lists, and a few have allergy notes. They answered "How did you hear about us?" and live in Athens-area ZIP codes.
- **Classes.** Teachers are on each class. One class is full with a waitlist, one is under the 5 students it needs ("at risk"), and the rest are in between.
- **Money:**
  - September and October tuition paid, and the November 1 charges scheduled;
  - the family 15% discount on a family with two children;
  - two failed payments, one with the $15 late fee;
  - one payment marked as paid by cash or check;
  - a credit and a refund;
  - a paid drop-in.

  All of it is recorded as test payments, and Stripe is never called.
- **Attendance:**
  - taken for past class dates, with a few absences and their reasons;
  - one child who missed two in a row;
  - a teacher's note to Hannah;
  - one class from this week left untaken, so "Attendance not taken" shows.
- **The rest:**
  - a day off with its credits;
  - tags (for example "Scholarship" and "Needs a ride");
  - skills ticked for a class, and a progress note waiting to send;
  - the fall show's cast and a rehearsal;
  - free class sign-ups, some of whom went on to enroll;
  - a few website enquiries (leads).
- **Last season's numbers** (made up) in Settings → Last season, so the dashboard shows comparisons.
- **An empty mailbox.** The emails written while making the data are cleared, so it starts empty and sign-in codes are easy to find.
- **Production is untouched.** The data is only made in the preview's build step (`npm run db:prepare-preview`). That step stops before doing anything when a real database is set, as it is in production.

## How we'll check it

- A unit test makes the demo data on a fresh database. It checks the counts above, and that every email address is `@example.com` and every phone number is a 555 number.
- The dashboard's numbers match their reports, as the reports test already checks, using the demo data.
- CI's existing check stays green: preparing the preview database must stay under 450 MB of memory (Render's free plan allows 512 MB).
- In a browser at computer width and at 390 px (phone width):
  - as `owner@example.com`: the dashboard tiles show numbers, a family's page shows payments, a class roster shows attendance, and "Needs attention" lists the failed payments and the untaken attendance;
  - as `teacher@example.com` on a phone: today's classes and the roster;
  - as `parent@example.com`: the family's account page.
- After it deploys, the same quick look on the live preview.

## Data

- Every name, email (`@example.com`) and phone number (`555`) is made up. Nothing comes from `imports/`, `.data/` or Studio Director.
- The data lives only in the preview's throwaway database. It is never sent anywhere, and it goes away with the preview.
- Allergy and medical notes are stored encrypted, the same way as on the real site.

## Needs a person's approval

- This plan, before any code.
- Nothing here touches the live site, prices, billing rules, Stripe, emails to real families or database migrations.

## Decisions

- **Approved** by Stephen on Oct 25, 2026.
- **Made when the preview is built.** The data is made once per deploy, so each wake starts from the same data. Dates are counted from the build day. After a few weeks without a deploy, "today" drifts away from the data; to refresh it, Render dashboard → the preview → Manual Deploy → "Deploy latest commit".
- **A shared owner sign-in.** Anyone with the preview link can sign in as `owner@example.com`, because the preview's mailbox is public. That is already true for any email on the preview. It's acceptable because everything there is made up and resets on restart.
- **Built with the site's own code.** Families sign up, pay, take attendance and so on through the same code the site uses (checkout uses a test payment, and the 1st-of-the-month charge uses the billing run). That way the numbers match what the pages work out. The dates are then moved back, so it looks like two months of use rather than one busy afternoon.

## Out of scope

- Real families, the Studio Director import, or anything on the live site.
- Keeping changes made on the preview across restarts (it still resets).
- Changing how the preview sleeps or wakes.
