# Playful wording: fixed lines on the class page and sign-up

For Hannah. These are the words on the class page and in the sign-up steps that the editor can't change. Nothing here is on the site yet. Answer by number, for example “yes to C1–C4, the bolder one for C9, not C14”, and the approved lines are put in after the change to how class dates show on the class page is finished.

The class descriptions themselves (taglines, summaries, paragraphs) are separate drafts you'll find in the editor as *Unpublished changes*; see [the drafts list](../seo/review.md).

- **26 lines**, in the order a family meets them. Some have a second, bolder option.
- **Left as they are on purpose:** prices, dates, times, addresses, the payment page, the policy summary, the autopay wording and the money words (tuition, fee, charged, due today), “First class free”, “season”, the age labels and class names. Error messages stay plain.
- Names in examples (Leo, Mia) are made up. `{email}` stands for the parent's email.

## Class page

### C1. Sign-up card, the “First class free” box at the top

- **Today:** New students try it free. Nothing is due until you decide to stay.
- **Proposed:** New students try their first class on us. Nothing is due unless your child wants to stay.
- **Bolder:** Come see if it clicks! New students try their first class on us, and nothing is due until you decide to stay.
- **Why:** Warmer, and uses the home page’s own idea that you only pay if your child wants to stay.
- **File:** `src/pages/programs/[slug].astro:133`

### C2. Sign-up card, heading

- **Today:** Choose a time
- **Proposed:** Pick a time that works
- **Bolder:** Places, everyone: pick a time
- **Why:** Friendlier heading; the phone bar’s “Choose a time” button stays as it is.
- **File:** `src/pages/programs/[slug].astro:139`

### C3. Sign-up card, main button (both places that set it)

- **Today:** Continue to enrollment
- **Proposed:** Sign up for this time
- **Bolder:** Let’s get you signed up
- **Why:** Plain, friendly words that still say exactly what the button does. “Join waitlist” and “Get notified” are unchanged.
- **File:** `src/pages/programs/[slug].astro:174 and :304`

### C4. Sign-up card, the line under the button

- **Today:** Next you’ll pick your student and pay in our family portal.
- **Proposed:** Next, you’ll choose who’s coming and pay in your family account.
- **Why:** Matches the next step’s heading (“Who’s coming”) and the name families see everywhere else (“family account”). The free-class and prorated sentences after it stay word for word.
- **File:** `src/pages/programs/[slug].astro:185`

### C5. Sign-up card when no dates are set yet (camps)

- **Today:** We announce summer camp a few weeks ahead. Leave your email and we’ll tell you as soon as registration opens.
- **Proposed:** We announce summer camp a few weeks ahead. Leave your email and you’ll be first to hear when registration opens.
- **Why:** Echoes the home page’s “Be first to hear about camps.”
- **File:** `src/pages/programs/[slug].astro:191`

### C6. Sign-up card for lessons and parties, heading

- **Today:** Book it
- **Proposed:** Let’s plan it
- **Why:** Sounds like the start of a conversation, which is what the request form is.
- **File:** `src/pages/programs/[slug].astro:195`

### C7. Sign-up card for lessons and parties, text

- **Today:** Scheduled around your family. Tell us what you have in mind and we’ll get back to you.
- **Proposed:** We’ll fit it around your family’s calendar. Tell us what you have in mind, and we’ll get back to you.
- **Why:** A full, warmer sentence with the same promise. The Ovation text is unchanged.
- **File:** `src/pages/programs/[slug].astro:196`

### C8. Under the sign-up card

- **Today:** Questions? Ask us before you sign up.
- **Proposed:** Not sure it’s the right fit? Ask us, and we’ll help you pick.
- **Why:** The home page’s own words; it answers the question parents actually have at this point.
- **File:** `src/pages/programs/[slug].astro:223`

### C9. Bottom of the page, heading above other classes

- **Today:** You might also like
- **Proposed:** Your Little Character might also love
- **Bolder:** More ways to play
- **Why:** Uses the brand’s own name for students instead of a stock phrase.
- **File:** `src/pages/programs/[slug].astro:271`

## Step 1: Sign in and who’s coming

### C10. Progress steps at the top of every step, the last one

- **Today:** Done
- **Proposed:** All set
- **Why:** Friendlier finish line; it still reads as the last step.
- **File:** `src/components/portal/EnrollShell.astro:18`

### C11. Sign-in box, text under “First, who’s signing up?”

- **Today:** Enter your email and we’ll send a 6-digit code. New here? That’s all it takes to create your family account. This device stays signed in for 90 days.
- **Proposed:** Enter your email and we’ll send a 6-digit code. New here? That’s all it takes to make your family account, no password needed. This device stays signed in for 90 days.
- **Why:** Adds “no password needed”, which is true and already said on the other sign-in screen, and takes away a common worry.
- **File:** `src/pages/enroll/[sessionId].astro:122`

### C12. Sign-in box, after the code is sent

- **Today:** We sent a code to {email}. It expires in 10 minutes.
- **Proposed:** Check your inbox! We sent a code to {email}. It expires in 10 minutes.
- **Why:** Tells the parent what to do next, in a friendly way; the 10 minutes stay.
- **File:** `src/components/portal/SignInPanel.astro:41`

### C13. A date that isn’t open yet

- **Today:** We haven’t opened registration for this date yet.
- **Proposed:** We haven’t opened registration for this date yet. Choose “Get notified” and we’ll email you when it opens.
- **Why:** Points to the button below instead of leaving the parent at a dead end.
- **File:** `src/pages/enroll/[sessionId].astro:116`

### C14. Notice when the class is full

- **Today:** This class is full. Choose your students to join the waitlist, and we’ll email you if a spot opens.
- **Proposed:** This class is full right now. Choose your students to join the waitlist, and we’ll email you if a spot opens.
- **Why:** “Right now” softens the news and is true: spots do open.
- **File:** `src/pages/enroll/[sessionId].astro:146`

### C15. Label beside a child who took the free class

- **Today:** Trial class taken · continue
- **Proposed:** Free class done · ready to continue
- **Why:** Says “free class”, the words families saw when they booked it.
- **File:** `src/pages/enroll/[sessionId].astro:174`

### C16. Age note beside a child outside the class’s ages (the first part comes from the class’s age label and stays exact)

- **Today:** Ages 7–10. Leo is 5. Ask us if you think it’s still a fit.
- **Proposed:** Ages 7–10. Leo is 5. Think it’s still a good fit? Ask us.
- **Why:** Puts the question first so “Ask us” reads as an invitation, not a rule. Ages and age are unchanged.
- **File:** `src/pages/enroll/[sessionId].astro:181`

### C17. First visit, no students saved yet

- **Today:** Add your first student below.
- **Proposed:** Add your first student below. We can’t wait to meet them!
- **Why:** A warm welcome at the very first step of a new family’s sign-up.
- **File:** `src/pages/enroll/[sessionId].astro:189`

### C18. Error when no student is ticked

- **Today:** Pick at least one student.
- **Proposed:** Pick at least one student to continue.
- **Why:** Calm and says why; no joke in an error message.
- **File:** `src/pages/enroll/[sessionId].astro:72`

## Step 2: Details

### C19. Heading

- **Today:** A few details
- **Proposed:** A few details for the teachers
- **Bolder:** A few things our teachers should know
- **Why:** Says who the answers are for, which makes the medical and pickup questions feel less like paperwork.
- **File:** `src/pages/enroll/details.astro:48`

## Step 3: Review & pay

### C20. Line under the heading

- **Today:** Enrolling Leo and Mia in Intro to Theater.
- **Proposed:** Almost there! Enrolling Leo and Mia in Intro to Theater.
- **Why:** A little encouragement just before the payment step. The heading “Review & pay” stays.
- **File:** `src/pages/enroll/review.astro:49`

### C21. Payment choice “Try the first class free”, its line

- **Today:** Nothing due today. Decide after the class.
- **Proposed:** Nothing due today. See if it clicks, then decide.
- **Why:** The home page’s own phrase; “Nothing due today” stays exact.
- **File:** `src/pages/enroll/review.astro:35`

## Step 4: Confirmation page

### C22. Line under “You’re in!”

- **Today:** Leo is enrolled in Intro to Theater. We sent a confirmation to {email}.
- **Proposed:** Leo is enrolled in Intro to Theater. We can’t wait to meet them! We sent a confirmation to {email}.
- **Bolder:** Leo has joined the cast of Intro to Theater! We sent a confirmation to {email}.
- **Why:** Celebrates the moment; “enrolled” stays in the first option so nobody wonders whether it worked.
- **File:** `src/pages/enroll/confirmation.astro:52`

### C23. Heading of the checklist

- **Today:** Before the first class
- **Proposed:** Getting ready for the first class
- **Bolder:** Before your child’s first rehearsal
- **Why:** Reads as a friendly checklist. The items under it (clothes, parking, late arrivals, autopay) stay word for word.
- **File:** `src/pages/enroll/confirmation.astro:77`

## Confirmation email

### C24. First line (enrolled, not waitlist)

- **Today:** Leo is enrolled in Intro to Theater.
- **Proposed:** Leo is enrolled in Intro to Theater. We can’t wait to meet them!
- **Why:** Matches the confirmation page (C22). The waitlist line is unchanged.
- **File:** `src/server/family.ts:359`

### C25. Free first class line

- **Today:** Your first class is free. After it, you can continue with monthly tuition or pay for the season from your family account.
- **Proposed:** Your first class is free. If it clicks, you can continue with monthly tuition or pay for the season from your family account.
- **Why:** Same choices and money words, with the site’s “see if it clicks” idea.
- **File:** `src/server/family.ts:361`

### C26. New last line, after the family account link

- **Today:** (no sign-off)
- **Proposed:** See you soon! The Little Characters team
- **Why:** The email ends on a link today; a short sign-off makes it sound like it came from people.
- **File:** `src/server/family.ts:364`
