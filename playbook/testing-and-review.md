# Testing and review

> Copied from SMB-AI ([playbook/testing-and-review.md](https://github.com/seppling/SMB-AI/blob/768425e/playbook/testing-and-review.md), commit 768425e, Oct 18, 2026). Change it there, then copy it here again. See [README.md](README.md).

Testing is checking that work does what it should. Review is a second look before a change takes effect. Both matter more with AI, because AI can produce work that looks finished and isn't. These practices put a check at the start, the middle and the end of every build (one thing being made, in its own folder).

## Practices

1. **Before building, write in `plan.md` how each feature will be checked, with real example cases.** The file `plan.md` is the build's written plan. If you know what a correct result looks like before the work starts, you can tell when it is finished. A real example is an actual customer question or an actual invoice, together with the answer you expect.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices); Foundation 2 and 3

2. **Ask for evidence (test output, the command and its result, a screenshot), not claims of success.** "It works" is not evidence. Ask Claude to show what it ran and what came back. If it can't show it, treat the work as not done.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

3. **Keep a small set of real test cases and rerun it after any change to prompts, tools or models.** This set is called an eval (short for evaluation), and a model is the AI itself, such as Claude. Rerunning the set shows whether a change helped or hurt, so you aren't guessing. Start with a handful of real cases and add one each time something goes wrong.
   Source: [Anthropic, Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents); [Hamel Husain, Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)

4. **Before you approve, a reviewer in a fresh context checks the change against `plan.md` and the foundation.** A fresh context is a clean start, with no memory of how the work was done. The reviewer compares what was built with what was planned and with the ten foundation principles. You then approve with a short, plain list of findings in front of you. When you approve, judge the intent: does the change do what `plan.md` asked, and nothing else? For an everyday change you do not need to read every line; the reviewer does that. Anything about money, customers, deleting data or going live you still read yourself before it goes out (practice 5). Anthropic's own engineers still review every change, read for intent, and save their closest look for the consequential ones.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices); [Anthropic, Redesigning source control at Anthropic](https://www.anthropic.com/engineering/redesigning-source-control); Foundation 1

5. **AI drafts; people approve anything consequential before it goes out.** Consequential means money, customers, deleting data or going live. Let AI prepare the invoice, the email or the change. A person reads it and decides whether it goes out.
   Source: [Lazy Leverage, We hosted an in-person AI event](https://lazyleverage.beehiiv.com/p/we-hosted-an-in-person-ai-event); Foundation 7
