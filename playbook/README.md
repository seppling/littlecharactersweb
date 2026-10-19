# Playbook (copied from SMB-AI)

The rules for building with AI live in Stephen's SMB-AI repo. That repo is the one source of truth (Foundation 8). This folder and `FOUNDATION.md` are copies, so Claude can read them in every session here.

- Copied from SMB-AI commit `768425e` (Oct 18, 2026).
- Never edit the copies here. Change SMB-AI, then copy the changed files here again in a pull request.
- Copy again after each quarterly review of the foundation (January, April, July and October), or when a weekly change in SMB-AI matters to this site.

## How SMB-AI's words map to this repo

SMB-AI keeps many projects, each called a build, in their own folders. This repo is a single build: the whole website and family portal.

| SMB-AI says | In this repo |
| --- | --- |
| `/new-build` | `/plan-feature` |
| a build's `plan.md` | `docs/plans/<name>.md` |
| a build's `CLAUDE.md`, under 50 lines | the root `CLAUDE.md`, under 150 lines, because it is the only one |
| a build's Decisions section | the plan's Decisions section, and `docs/todo.md` for decisions about the whole site |
| `/review-change` | `/review-change`, with this site's checks |
| the planner, builder and reviewer | the same three agents, in `.claude/agents/` |
| an experiment, kept apart from what people depend on (Foundation 9) | its own branch, tried on a computer or a Render preview (`render.yaml`), never on `main` |

The weekly scan, research and trials (including the Ponytail add-on) stay in SMB-AI. They were not copied.

## Pages

- [Foundation: why each principle exists](foundation.md)
- [Prompting](prompting.md)
- [Project structure](project-structure.md)
- [Agents](agents.md)
- [Testing and review](testing-and-review.md)
- [Data and security](data-and-security.md)
