# Project structure

> Copied from SMB-AI ([playbook/project-structure.md](https://github.com/seppling/SMB-AI/blob/768425e/playbook/project-structure.md), commit 768425e, Oct 18, 2026). Change it there, then copy it here again. See [README.md](README.md).

Structure means where files go and what each file is for. In this repo (the folder that holds all of this project's files), one thing being made is called a build, and each build gets its own folder. Good structure means a new session, or a new person, can open a build and quickly see what it is, what it should do and how it was decided.

## Practices

1. **Each build lives in `builds/<name>/`, with `CLAUDE.md`, `plan.md` and `README.md`.** `CLAUDE.md` is the short rulebook Claude reads at the start of each session. `plan.md` says what the build does and what "done" means. `README.md` explains the build to a person.
   Source: [Claude Code memory](https://code.claude.com/docs/en/memory); [this spec](https://github.com/seppling/SMB-AI/blob/768425e/docs/superpowers/specs/2026-10-13-ai-builder-playbook-design.md)

2. **`CLAUDE.md` holds only what Claude can't work out alone. Ask of each line: would removing it cause mistakes? Root under 150 lines; builds under 50.** A long rulebook gets ignored, because the important lines get buried. The root file is the one at the top of the repo. Cut any line Claude would get right without it.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices); [Claude Code memory](https://code.claude.com/docs/en/memory)

3. **Record decisions in the build's `plan.md` Decisions section as they're made.** A decision kept only in a chat is lost when the session ends. Written in `plan.md`, it shows the next session what was chosen and why. Josh Schultz argues for settling decisions before an AI starts building rather than leaving it to guess.
   Source: [Josh Schultz, Pull Decisions Forward](https://joshuaschultz.com/ai/articles/pull-decisions-forward-agentic-execution/); Foundation 2

4. **One file, one job; split a file once it does more than one thing.** A small file with a single purpose is easier to follow, and Claude can change it without breaking something else. When a file starts to cover two topics, split it.
   Source: Foundation 4

5. **Document every data source a build reads, and check the documentation against the real data.** A data source is any place a build gets information, such as a spreadsheet, a database or a web service. Write down what each one holds and where it lives, then compare the description with the real data. Notes that no longer match the data mislead people and AI alike.
   Source: [Mark Ajzenstadt, thread on AI-ready data](https://x.com/mardehaym/status/2108162891950256274) (sells data modernization work); Foundation 8
