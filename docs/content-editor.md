# Editing the site

A guide for Hannah (and anyone else on staff) to changing what families see on littlecharacters.org.

## Signing in

Go to **littlecharacters.org/admin/content** and enter your staff email. We email you a 6-digit code; type it in and you're in for 90 days on that device. There's no password.

Only emails on the staff list can edit. Stephen adds people to it (`ADMIN_EMAILS` on the host).

When you're signed in and browsing the site, an **Edit this page** button sits in the bottom corner. It opens the editor for whatever you're looking at.

## How changes go live

1. Open what you want to change and edit it.
2. **Save draft** keeps your changes without showing them to anyone. Come back later and they're still there.
3. **Preview** shows the real site with your changes, just for you. A purple bar at the top reminds you it's a preview; **Back to editing** returns you to the form.
4. **Publish** puts it on the site right away.

Families only ever see what's published. If you change your mind before publishing, **Discard unpublished changes** (in the box beside the form) goes back to what's on the site.

## Undo: history

Every time something is published, the old version is kept. Open **History and older versions** beside the form, pick a version and press **Restore this version**. It comes back as a draft so you can check it, then **Publish**.

Deleted something by mistake? At the bottom of each list is **Recently deleted**. Press **Bring back**, then publish.

## What you can edit

| In the editor | What it changes |
|---|---|
| **Announcement & site settings** | The announcement bar across the top of every page, the email and phone number, social links, the Giving settings (the donation link behind "Give now", which reads "Email us to give" while it's empty, an optional tax note shown under it, and the wish list link), the last day of Studio Director billing for imported families' welcome note, and the parking directions with their two maps (walk-in and drop-off, shown on the contact page; tap a map there to see it full size). **Class sign-ups** holds the late-joining cut-off for weekly classes (4 weeks by default). Also the "Design preview" note, which should be turned off at launch. |
| **Classes & camps** | Every class, camp, workshop, lesson and party: descriptions, ages, prices, photos, and the sessions families enroll in. |
| **Shows & events** | Performances, Parents' Night Out, free classes and improv nights. Past events drop off the site on their own. |
| **FAQs, Team, Testimonials, Locations** | The lists those pages are built from. |
| **Pages** | The words and photos on the home, About, Team, Schools & partners, Camps, Geode, Give, Contact, FAQ, Policies, class finder and events pages, section by section, plus what Google shows for each one. The Team page's heading, intro, quote and "working with us" line are under **Pages → Team page**; the people themselves are under **Team**. |
| **Photos** | Upload photos and describe them. Any photo field can then use them. |

What stays with Stephen: the layout and design, new kinds of pages, prices and discounts built into the billing rules (the 10% and 15% discounts, the late fee), and the enrollment steps.

## Common jobs

**Starting a new term.** Open each class, and under **Sessions** press **Copy** on last term's session. Change the term name and the first and last days, then publish. The old session leaves the site on its own (see below); keep it, since enrollments and payments point to it.

**When dates leave the site.** The dates decide; a session's registration status only adds limits on top (**Closed**, **Full: waitlist only**, **Coming soon**). "Open" never keeps a past date bookable.

- A one-night date (Parents' Night Out, a workshop, the free class) closes when it starts, and leaves the site after that day.
- A camp week closes when the week starts.
- A weekly class takes late joiners (their first month is prorated) until the late-joining cut-off: **Announcement & site settings → Class sign-ups**, 4 weeks before the last class by default.
- In the editor, those sessions are marked **Sign-ups closed** (still running) or **Ended** (after the last day), so you can see why a date isn't on the site. Families who signed up still see them in their account.
- The rule is in `src/lib/session-dates.ts`.

**A class is full.** Open its session and set **Registration** to **Full: waitlist only**. New families can join the waitlist instead.

**Something's happening this week.** Edit the cards under **What's on now** (the "On the call sheet" section of the home page). The arrows move a card up or down.

**News for everyone.** In **Announcement & site settings**, tick **Show the announcement bar**, write one line, and add a link if it helps ("See classes" → `/programs`).

**A new photo.** In any photo field, press **Choose photo**, then **Upload a new photo**. Photos from a phone are fine; they're resized automatically and the location data the camera saves is removed. Then click the most important part of the photo (usually a face) so it stays in view when the photo is cropped, and describe it in a few words for people who can't see it. Only use photos of children whose families said yes to photos.

**A new show.** Under **Shows & events**, add an event with **Kind** set to **Show**. Each show gets its own page at `littlecharacters.org/events/` plus its **Short name for links** (for example `/events/fall-variety-show`), and its name on the events list links there. Give it a **Photo** if you have one: it shows on the show's page and when someone shares the link. Choose a place under **Where** (not "Or another venue") so Google can list the show in its event results: Google needs the street address and the date. After the show, the page stays up with a note that it has happened, so shared links keep working.

**Nights that repeat.** Parents' Night Out, the free class and improv night don't get a page for each date. Their **Class page** field picks the class page that tells more, and the event's name links there. The **Button** (like the registration form) stays as it is.

**What Google shows.** Every page, every class and every show has a **Search engines** box with a title and a description. Leave them empty to use the page's usual heading and intro (for a class, its name and summary). The title gets " · Little Characters" added at the end, unless it already says Little Characters. When someone shares a link to a page, the preview shows that page's main photo (a class's photo, or the photo at the top of the page), cropped around the spot you clicked; other pages show the home page photo. To pick a different picture for the preview (the Geode page, for example), set **Photo when the page is shared** in the same box: it wins over the page's usual photo, and it's cropped to the same wide shape around its focus point. Empty it to go back to the usual photo.

**A discount for one family** (a scholarship, a sibling deal, a credit for a missed class) isn't in the editor: it's on the family's payments page. See [Giving a family a discount](staff-billing.md).

## Writing tips

- **Links:** `[the words to click](/contact)` or `[our wish list](https://a.co/...)`.
- **Bold:** `**like this**`.
- **Headlines:** wrap a word in single asterisks, `Every person has a *story* worth telling.`, to put the spotlight on it.
- **Words in curly braces** like `{email}`, `{phone}` and `{founded}` are filled in from the site settings, so they're always current. The help text under a field says which ones it understands.
- Leave a blank line between paragraphs in longer text.

## Safety nets

- A session that families have signed up for can't be removed. Close it instead, so their enrollments and receipts still make sense.
- Changing a price only affects new enrollments. Families already enrolled keep the monthly charges they agreed to.
- A published class or event keeps its web address, so old links keep working.
- Something another page uses (a location, a quote, an FAQ on the About page) can't be deleted until it's no longer used. The editor says where it's used.
- If two people edit the same thing at once, whoever publishes last wins. Check with each other before big changes.
