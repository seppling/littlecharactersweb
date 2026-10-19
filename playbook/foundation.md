# Why the foundation is what it is

> Copied from SMB-AI ([playbook/foundation.md](https://github.com/seppling/SMB-AI/blob/768425e/playbook/foundation.md), commit 768425e, Oct 18, 2026). Change it there, then copy it here again. See [README.md](README.md).

This page gives the reasons behind the ten principles in [FOUNDATION.md](../FOUNDATION.md). Read it when you want to know "why do we do this?" Like the principles, it changes only at the quarterly review, which happens once every three months.

Each section has three parts. **What it means** says the principle in everyday words. **Why** gives the reasoning. **Sources** lists where the idea comes from. Every link was opened on 2026-10-13.

## 1. Every change is small, saved as a version, and reviewed before it takes effect

**What it means**

Make one small change at a time. Save each change as a version, so you can see what changed and go back if needed. A second pair of eyes checks it before it counts. The tool for saving versions is called Git. A pull request is a proposed change that waits for approval before it joins the main copy.

**Why**

A big change hides its mistakes. A small one is quick to read, quick to check and easy to undo. Google's code review guide asks for small changes for these reasons. Anthropic, the company that makes Claude, gives similar advice in its guide to Claude Code (the tool Claude works in): check Claude's work, and do not take it on trust.

**Sources**

- [Google Engineering Practices, Code Review](https://google.github.io/eng-practices/review/): how Google's engineers review each other's changes.
- [Claude Code best practices](https://code.claude.com/docs/en/best-practices): Anthropic's advice for working with Claude Code.

## 2. Write down what you're building and what "done" means before building

**What it means**

Before any building starts, write a short plan. It says what the thing does, what it does not do, and how you will know it is finished. Choices made along the way are added to the plan.

**Why**

AI builds fast, and fast work in the wrong direction wastes time. A written plan lets you catch a wrong turn before anything is built. It also lets a new session pick up where the last one stopped. Anthropic recommends exploring and planning before coding. Josh Schultz argues for settling decisions before an AI agent (an AI that takes steps on its own) starts work.

**Sources**

- [Claude Code best practices](https://code.claude.com/docs/en/best-practices): Anthropic's advice for working with Claude Code.
- [Josh Schultz, Pull Decisions Forward](https://joshuaschultz.com/ai/articles/pull-decisions-forward-agentic-execution/): an article on making decisions before agentic (self-directed) AI work begins.

## 3. Nothing is done until it has been checked against real cases

**What it means**

"Done" means someone ran the work on real examples and looked at the results. Saying "it should work" does not count. A real case is something from the business, such as an actual customer email or an actual invoice.

**Why**

AI can produce work that looks right and is wrong. Made-up examples tend to be easy, so they hide problems that real ones show. Anthropic says to give Claude a way to check its own work. Hamel Husain and Anthropic's guide to testing AI agents both say to look at real outputs and build checks from the failures you find.

**Sources**

- [Claude Code best practices](https://code.claude.com/docs/en/best-practices): Anthropic's advice for working with Claude Code.
- [Hamel Husain, A Field Guide to Rapidly Improving AI Products](https://hamel.dev/blog/posts/field-guide/): a practical guide to finding and fixing AI problems.
- [Anthropic, Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): how to test AI agents. An "eval" is a set of checks for an AI's work.

## 4. Build small parts, each with one job and clear inputs and outputs

**What it means**

Each part does one thing. You can say what goes into it and what comes out. Parts connect to each other only through those inputs and outputs.

**Why**

A small part is easy to understand, test and replace. When something fails, you know where to look. It also helps AI. Anthropic's guide to writing tools for agents says a tool should have a clear purpose and clearly described inputs and results.

**Sources**

- [Anthropic, Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents): how to design the tools an AI agent uses.
- [Josh Schultz, Decision Architecture: AI as Compiler](https://joshuaschultz.com/ai/articles/decision-architecture-ai-as-compiler/): an article on "decision architecture": building a business's know-how into reusable parts once, so the AI assembles answers from them instead of starting from scratch.

## 5. Keep passwords and settings out of the code, and give each tool the least access it needs

**What it means**

Passwords, keys and settings that change from place to place are kept in environment settings. These are a protected spot outside the code. Each tool, connector or agent gets only the access its job needs. A connector is a link that lets Claude use another service, such as email. Read-only is the default.

**Why**

Code gets copied, shared and saved in history, so a password inside it travels with it. Limited access limits the damage when something goes wrong. Simon Willison describes the worst case as the "lethal trifecta". It happens when an AI can see private data, read content from outsiders and send information out. Such an AI can be tricked into leaking the private data. Take away any one of the three and the trick fails.

**Sources**

- [The Twelve-Factor App, Config](https://12factor.net/config): the standard advice to keep settings out of the code.
- [Simon Willison, The lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/): why some combinations of AI access are dangerous.
- [Claude Code permissions](https://code.claude.com/docs/en/permissions): how to limit what Claude Code can read and do.

## 6. Use plain code for fixed rules; use AI only where judgment is needed

**What it means**

If a rule can be written as exact steps, write it as ordinary code. Examples are "add 8% tax" or "send the report every Monday". Use AI for the parts that need judgment, such as reading a messy email or drafting a reply.

**Why**

Plain code gives the same answer every time and costs almost nothing to run. AI costs money on every use and can be wrong in new ways. Anthropic advises finding the simplest solution and adding complexity only when needed. The 12-Factor Agents guide describes good AI products as mostly ordinary software with AI used at the right points.

**Sources**

- [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents): when to use fixed workflows and when to use open-ended agents.
- [HumanLayer, 12-Factor Agents](https://github.com/humanlayer/12-factor-agents): principles for building dependable AI software.
- [Lazy Leverage, I spent $1,200 in two days on GrokBot](https://lazyleverage.beehiiv.com/p/i-spent-1200-in-two-days-on-grokbot): a newsletter post by Jon Matzner about spending $1,200 in two days on an AI bot.

## 7. People approve anything consequential: money, customers, deleting data, going live

**What it means**

AI can prepare these actions. A person decides. They cover spending money, contacting customers, deleting data and going live. Going live means making something available for real use.

**Why**

Some mistakes can't be taken back. A wrong email can't be unsent, and deleted data may be gone for good. OpenAI's guide to building agents recommends handing high-risk actions, such as payments, to a person. Josh Schultz's framework is about which decisions AI may make and which belong to people.

**Sources**

- [OpenAI, A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf): includes when an agent should hand a task to a person.
- [Lazy Leverage, We hosted an in-person AI event](https://lazyleverage.beehiiv.com/p/we-hosted-an-in-person-ai-event): a newsletter post by Jon Matzner about an in-person AI event.
- [Josh Schultz, L1-L2-L3-L4 framework: AI vs human decisions](https://joshuaschultz.com/knowledge-base/l1-l2-l3-l4-framework-ai-vs-human-decisions/): which decisions belong to AI and which to people.

## 8. Keep one documented source of truth for each kind of data

**What it means**

For each kind of information, such as customers, prices or orders, one place holds the correct version. That place is written down. Everything else reads from it instead of keeping its own copy.

**Why**

When two copies disagree, nobody knows which is right, and an AI will pick one with confidence. Written documentation tells people and AI what the data means and where it lives. Mark Ajzenstadt's thread lists the steps that get data ready for AI. It starts with finding the data and putting it in one place.

**Sources**

- [Mark Ajzenstadt, thread on AI-ready data](https://x.com/mardehaym/status/2108162891950256274): the steps for getting data ready for AI.
- [Black Arc Industrial, Retrieval, not storage](https://blackarcindustrial.com/insights/retrieval-not-storage/): an article on retrieval (finding the right information when it is needed) as opposed to simply storing data. It favors reading current data from the source systems when a decision needs it, rather than copying everything into one store.

## 9. Keep experiments apart from anything people depend on

**What it means**

Try new ideas in a separate place, not in the tools you or your customers use every day. An idea moves into real use only after it has proven itself. In this project, an unproven idea is tried in a single build (one thing being made, in its own folder) first and is tracked in `research/trials.md`.

**Why**

Experiments break things, and that is part of how you learn. Kept apart, a failed experiment costs nothing, and nobody who depends on the real thing notices. Jon Matzner's newsletter puts it as two modes of work: experiment freely, then ship carefully.

**Sources**

- [Lazy Leverage, Experiment like a lunatic, ship like an adult](https://lazyleverage.beehiiv.com/p/experiment-like-a-lunatic-ship-like-an-adult): a newsletter post by Jon Matzner on trying ideas freely and shipping carefully.
- [Claude Code best practices](https://code.claude.com/docs/en/best-practices): Anthropic's advice for working with Claude Code.

## 10. Measure outcomes, not activity

**What it means**

Count results the business cares about, such as hours saved, sales closed or mistakes avoided. Do not count how much the AI did, such as messages sent, code written or tasks run.

**Why**

Activity is easy to count and easy to mistake for progress. In 2025, METR timed experienced developers on real tasks. With AI tools they took 19% longer, yet they believed the tools had sped them up. Black Arc Industrial's article ties AI productivity to revenue and margin.

**Sources**

- [Black Arc Industrial, AI productivity, revenue and margin](https://blackarcindustrial.com/insights/ai-productivity-revenue-margin/): an article linking AI productivity to revenue and margin.
- [METR, early-2025 AI and experienced open-source developers](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/): a study that timed developers working with and without AI tools.
