# Giving a family a discount

A guide for Hannah (and anyone else on staff) to scholarships, pay-what-you-can, sibling deals and credits on a family's monthly payments. The site works these out itself; there's nothing to set up in Stripe.

## Give a discount

1. Go to **littlecharacters.org/admin/payments** and sign in with your staff email.
2. Under **Families on autopay**, press **Payments & discounts** next to the family and class.
3. Under **Add a discount**, choose:
   - **A dollar amount** (for example 40) or **a percentage** (for example 25);
   - **Next payment only**, or **Every remaining month**;
   - a **Reason**, like "scholarship" or "credit for the missed class on Oct 6". A reason is required.
4. Press **Check the new amounts**. You see each payment that changes, now and after. Nothing is saved yet.
5. Press **Save discount**, or **Cancel**.

Good to know:
- It comes off **after** the family discount (15% for multiple students or classes, below), and the cent is rounded in the family's favor.
- A payment never goes below $0. A month the discount covers completely isn't charged at all; the family gets a "nothing to pay" email instead of a receipt.
- The $15 late fee isn't discounted. To drop a late fee, use **Waive late fee** under **Needs attention** on the Payments page.
- Payments already made never change. To give money back for those, refund in the Stripe dashboard.
- A family who paid the whole season up front has no payments left to discount. Refund part of it in the Stripe dashboard instead.
- If the family has the "pay now" page open, or a charge is going through at that moment, that month changes a little later (within a day, before it's charged).

## Remove a discount

On the same page, press **Remove** next to the discount and confirm. The payments it lowered that aren't paid yet go back to their usual amount. Paid ones stay as they were. Removed discounts stay listed under **Removed discounts**, with who removed them and when.

## What the family sees

In their family account, each payment with a discount shows a line like **Discount: −$40**, and the amount they'll be charged. The receipt email and the card charge say the same.

The reason you typed is **private**: families see "Discount". If you want them to see it (for example "Scholarship: −$40"), tick **Show the reason to the family** when you add it.

## The family discount (15%)

Families with more than one child or class get it on their own; there's nothing for you to do.

- **What families get:** once a family has **two or more children or classes enrolled in weekly classes**, every monthly payment they haven't made yet, for all their weekly classes, is 15% off. It doesn't matter who signed up first: when Ben joins, Ava's next months drop from $95 to $80.75 too.
- **What counts:** each child in each weekly class, paid by the month or by the session (Little Characters and Geode). Since Oct 13, 2026, classes paid by the session, like Stories & Songs and the Homeschool Class, count too: they have no monthly payments of their own to lower, but they count toward the two. Not a free trial class, the waitlist, drop-in nights like Geode Adult Improv, camps, workshops, parties, Parents' Night Out or Ovation. Two children signing up together for a class still get 15% on that sign-up, except for drop-in nights, which never get it.
- **When it starts:** as soon as the second enrollment is paid. The family sees "Ava's remaining monthly payments also drop to $80.75 with the 15% family discount" before they pay, and again in their confirmation email.
- **When it stops:** when the family is down to one: a class ends, or you press **Stop payments** for a child who withdraws. Their other unpaid months go back to the regular price. Before you confirm Stop payments, the page shows which payments go back up and by how much. The family gets an email, "Your family discount has ended", listing the new amounts (for example "Ava, Intro to Theater: $95 on Nov 1 and Dec 1 (was $80.75)"), and sees them in their account.
- **Seasons paid in full:** a child whose season is paid up front still counts toward the two, but that payment never changes: no refund, and the 10% for paying up front still doesn't add to the 15%.
- **Months already paid** never change, in either direction.
- **With your discounts:** the family discount comes first, then yours. For example, a 10% scholarship on $95: $95 less 15% is $80.75, then 10% off that is $72.67.
- **Where you see it:** on the family's **Payments & discounts** page, in its own **Family 15%** column, apart from the discounts you added. Families see "Family discount (15%): −$14.25" in their account, on receipts and on their card statement.

## The Payments page

**littlecharacters.org/admin/payments** has four parts. The buttons at the top show everything, only **Needs attention**, or only **Upcoming autopay**.

- **Needs attention:** charges that didn't go through, and charges waiting for the family to pay. Each shows the family (tap the name for their page), the month, the amount with any late fee, why it failed and when it's tried again. The buttons:
  - **Send a pay link** emails the parents the same "pay now" message they got when the charge failed. The item then says "Pay link sent Oct 19".
  - **Paid by cash/check** when the family paid you another way.
  - **Waive late fee**, when there is one.
  - **Stop payments** (below).
- **Upcoming autopay:** the next charge day and the two months after it, by date, with each day's total.
- **Families on autopay:** each family and class with payments left, with **Payments & discounts** and **Stop payments**.
- **Payments received:** what came in during a month, newest first: monthly charges and sign-up payments, by card or marked paid by cash or check. It shows this month; use the arrow or the month box to see another.

Each of Needs attention, Upcoming autopay and Payments received has **CSV** and **PDF** downloads: the **Overdue List**, **Upcoming Autopay** (the next 90 days) and the **Payments List** (the month shown). If you signed in more than 15 minutes ago, the site emails you a code first.

## Stop payments

When a family withdraws, press **Stop payments** on the Payments page (under **Needs attention**, or next to the family under **Families on autopay**). You see the charges that will be cancelled and, if the family drops below two classes, which of their other payments go back up. Press **Stop payments** again to confirm, or **Cancel**.

## Remove a child from a class

On the class's page (**Classes**, then the class), press **Remove** under the child, then choose:

- **Remove and stop payments** when the family withdraws. Their upcoming charges for that class are cancelled. If a brother or sister on the same sign-up stays in the class, the payments carry on (they cover both children); the page says so and links to the order, where you can add a discount to lower them.
- **Remove only** when the child moved to another class and you're sorting out their payments yourself. Nothing about payments changes.

Before anything is saved, you see what changes: the charges that stop and, if the family drops below two classes, which of their other payments go back up from the 15% family discount (they're emailed about it, as with Stop payments). Press the red button to confirm, or **Cancel**.

The child leaves the roster, and the family's page shows the class as Cancelled. Nothing already paid is refunded and the last month isn't prorated: if you want to give money back, refund it in the Stripe dashboard.

## Add a child to a class

On the class's page, press **Add a child**, type the child's name and press **Find**. Next to the child, choose:

- **Send a sign-up link**: the parents get an email with the link to sign up for this class. They pay as usual, with the usual discounts. Use it for a phone sign-up. The email shows on the family's page under Emails sent.
- **Add without charge**: for a scholarship, a staff child or a trade. You may be asked to confirm it's you first (an emailed code). Type a **reason**, then press **Add without charge**. The child is on the roster with no payments, and shows as **No charge, added by staff: <your reason>** on the roster, on the family's page and on the Payments page (under **No charge**). It doesn't count toward the 15% family discount, so nobody else's payments change.

If the class is full, you're warned and need to tick **Add anyway** (or **Send anyway**). A link to a full class only lets the family join the waitlist. A child outside the class's ages gets a warning; you can still go ahead. A child already in the class can't be added twice.

## Offer a waitlisted family the place

When a place opens, Today shows it under **Waitlist openings**. On the class's page, under **Waitlist**, press **Offer the spot** next to the child, then **Send the offer**. The family gets an email: "A place opened in <class>. Sign up by <day and time> to take it." They have **48 hours**, and the place goes to the first family who signs up and pays.

- The waitlist shows "Offered Oct 19, 2026, expires Wed, Oct 21 at 3:15 pm". **Withdraw offer** takes it back; the child stays on the waitlist.
- When the time runs out, it says **Expired: offer to the next family**. Offer it to the next child, or to the same one again.
- When the family pays, the child moves from the waitlist to the roster, and the offer is done. Today stops counting a place that's on offer.

## Drop-ins

A child can come to one class of a weekly class and pay for that date. **$25 a class** for now: a placeholder until you confirm the price. Change it in the website editor under **Announcement & site settings → Drop-ins** (untick **Families can book drop-ins** to stop them). A class can have its own price, or none, under its dates (**Drop-ins**). Camps, workshops, nights out, parties and Ovation don't take drop-ins. A drop-in gets no discounts and doesn't count toward the 15% family discount.

- **Families** book from the class's page ("Drop in for one class · $25") once the class has started or starts within two weeks, or from their account. They pick a date and a child, agree to the policies and pay by card. A full date or a day off can't be picked. They get a confirmation email.
- **On the class's page:** pick a date under **Roster** ("Drop-ins on …") to see who's coming that day; drop-ins have a **Drop-in** label. The **Drop-ins** list shows every drop-in with what was paid. **Over the limit** means a family paid after the date filled up: the payment is kept, so decide whether they come.
- **Add a drop-in:** find the child, then **Send a pay link** (the family gets an email to pay for the date you pick; nothing is held until they pay) or **No charge** (confirm it's you, pick a date, type a reason).
- **Cancel** a drop-in with a reason. Nothing is refunded here: refund it in the Stripe dashboard for now.

## The record

Every discount shows who added it and when, and every add and remove is written to the site's audit log. So is every child added, removed or offered a place from a class's page, with the reason for a no-charge place, and every drop-in added, paid or cancelled, with its reason. Each time the family discount changes a family's payments, that's logged too.
