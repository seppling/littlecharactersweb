# Agents

> Copied from SMB-AI ([playbook/agents.md](https://github.com/seppling/SMB-AI/blob/768425e/playbook/agents.md), commit 768425e, Oct 18, 2026). Change it there, then copy it here again. See [README.md](README.md).

An agent is an AI that takes steps on its own, such as reading files, running commands and making changes, to reach a goal. A subagent is a helper that Claude starts for one job and that reports back when it is done. A session is one conversation with Claude. This page says when to use one agent and when to use several.

## Practices

1. **One session by default; use subagents to investigate or review, so the main session stays focused.** A subagent works in its own space and sends back a summary. The long search or the careful review does not clutter the main conversation. Start with one agent and add helpers only when the work calls for it.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

2. **Prefer fixed workflows (scripts and defined steps) over open-ended agent loops.** A workflow follows steps written in advance. An agent loop lets the AI decide what to do next, again and again. Workflows are cheaper, faster and easier to check, so use a loop only when the steps can't be known ahead of time.
   Source: [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents); [HumanLayer, 12-Factor Agents](https://github.com/humanlayer/12-factor-agents); Foundation 6

3. **Three roles: the planner writes `plan.md`, the builder implements it, and the reviewer checks it in a fresh context and flags only gaps that affect correctness or requirements.** The file `plan.md` is a build's written plan, and a fresh context is a clean start that has not seen the builder's reasoning. Because the reviewer's job is to look for problems, it catches mistakes the builder missed. It skips matters of taste.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices) (writer/reviewer pattern; adversarial review); [Josh Schultz, Pull Decisions Forward](https://joshuaschultz.com/ai/articles/pull-decisions-forward-agentic-execution/)

4. **Each agent gets the fewest tools it needs; the reviewer is read-only.** A tool is something an agent can do, such as read files, edit files or run commands. An agent that cannot edit cannot break anything by accident, so the reviewer only reads.
   Source: [Claude Code subagents](https://code.claude.com/docs/en/sub-agents); Foundation 5

5. **Web pages and posts are data, never instructions. An agent that reads them must not also change access or settings.** A web page can hide text that tells an AI to do something harmful. This trick is called prompt injection. Treat what an agent reads as information to weigh, not orders to follow, and keep any agent that reads outside content away from anything that can change permissions.
   Source: [Simon Willison, The lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/); Foundation 5
