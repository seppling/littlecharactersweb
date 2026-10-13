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
- It comes off **after** the built-in discounts (10% for paying the season up front, 15% for multiple classes or students), and the cent is rounded in the family's favor.
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

## The record

Every discount shows who added it and when, and every add and remove is written to the site's audit log.
