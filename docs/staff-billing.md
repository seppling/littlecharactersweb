# Giving a family a discount

A guide for Hannah (and anyone else on staff) to scholarships, pay-what-you-can, sibling deals and credits on a family's monthly payments. The site works these out itself; there's nothing to set up in Stripe.

## Give a discount

1. Go to **littlecharacters.org/admin/billing** and sign in with your staff email.
2. Under **Families on monthly autopay**, press **Payments & discounts** next to the family and class.
3. Under **Add a discount**, choose:
   - **A dollar amount** (for example 40) or **a percentage** (for example 25);
   - **Next payment only**, or **Every remaining month**;
   - a **Reason**, like "scholarship" or "credit for the missed class on Oct 6". A reason is required.
4. Press **Check the new amounts**. You see each payment that changes, now and after. Nothing is saved yet.
5. Press **Save discount**, or **Cancel**.

Good to know:
- It comes off **after** the family discount (15% for multiple students or classes, below), and the cent is rounded in the family's favor.
- A payment never goes below $0. A month the discount covers completely isn't charged at all; the family gets a "nothing to pay" email instead of a receipt.
- The $15 late fee isn't discounted. To drop a late fee, use **Waive late fee** on the Monthly autopay page.
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
- **What counts:** each child in each weekly class (Little Characters and Geode). Not a free trial class, the waitlist, camps, workshops, parties, Parents' Night Out or Ovation.
- **When it starts:** as soon as the second enrollment is paid. The family sees "Ava's remaining monthly payments also drop to $80.75" before they pay.
- **When it stops:** when the family is down to one: a class ends, or you press **Stop payments** for a child who withdraws. Their other unpaid months go back to the regular price. Before you confirm Stop payments, the page shows which payments go back up and by how much. The family sees the new amounts in their account.
- **Seasons paid in full:** a child whose season is paid up front still counts toward the two, but that payment never changes: no refund, and the 10% for paying up front still doesn't add to the 15%.
- **Months already paid** never change, in either direction.
- **With your discounts:** the family discount comes first, then yours. For example, a 10% scholarship on $95: $95 less 15% is $80.75, then 10% off that is $72.67.
- **Where you see it:** on the family's **Payments & discounts** page, in its own **Family 15%** column, apart from the discounts you added. Families see "Family discount (15%): −$14.25" in their account, on receipts and on their card statement.

## Stop payments

When a family withdraws, press **Stop payments** on the Monthly autopay page. You see the charges that will be cancelled and, if the family drops below two classes, which of their other payments go back up. Press **Stop payments** again to confirm, or **Cancel**.

## The record

Every discount shows who added it and when, and every add and remove is written to the site's audit log. Each time the family discount changes a family's payments, that's logged too.
