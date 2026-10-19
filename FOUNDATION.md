# Foundation

> Copied from SMB-AI ([FOUNDATION.md](https://github.com/seppling/SMB-AI/blob/768425e/FOUNDATION.md), commit 768425e, Oct 18, 2026). Change it there, then copy it here again. See [playbook/README.md](playbook/README.md).

These principles change only at the quarterly review, which happens once every three months ([Section 3 of the design spec](https://github.com/seppling/SMB-AI/blob/768425e/docs/superpowers/specs/2026-10-13-ai-builder-playbook-design.md)), and the reasons for each one are in [playbook/foundation.md](playbook/foundation.md).

1. **Every change is small, saved as a version, and reviewed before it takes effect.**
   A big change hides mistakes. Small, saved changes are easy to check and easy to undo.
2. **Write down what you're building and what "done" means before building.**
   A written plan lets you catch a wrong turn before any work is wasted.
3. **Nothing is done until it has been checked against real cases.**
   "It should work" does not count. Try it on real examples and look at the results.
4. **Build small parts, each with one job and clear inputs and outputs.**
   Small parts are easier to understand, test and replace.
5. **Keep passwords and settings out of the code, and give each tool the least access it needs.**
   Code gets copied and shared. Limited access keeps a mistake or a trick from becoming a disaster.
6. **Use plain code for fixed rules; use AI only where judgment is needed.**
   Plain code gives the same answer every time and costs almost nothing to run.
7. **People approve anything consequential: money, customers, deleting data, going live.**
   AI can prepare the work. A person makes the final call.
8. **Keep one documented source of truth for each kind of data.**
   When two copies disagree, nobody knows which one is right.
9. **Keep experiments apart from anything people depend on.**
   A failed experiment should cost nothing.
10. **Measure outcomes, not activity.**
    Count results the business cares about, not how busy the AI was.
