# Prompting

> Copied from SMB-AI ([playbook/prompting.md](https://github.com/seppling/SMB-AI/blob/768425e/playbook/prompting.md), commit 768425e, Oct 18, 2026). Change it there, then copy it here again. See [README.md](README.md).

A prompt is the message you give Claude. A session is one conversation with Claude, from the first message to the last. How you write the prompt and how you run the session decide how good the result is. These practices come mostly from Anthropic, the company that makes Claude. They follow its advice for Claude Code, the tool that lets Claude read and change the files in this repo (the folder that holds all of this project's files).

## Practices

1. **Say what "done" looks like and give Claude a check it can run: tests, a script or a screenshot.** Claude does much better when it can check its own work. Without a check, you are the only one who can catch mistakes. A test is a small program that confirms another program gives the right answer.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices); Foundation 3

2. **Be specific: name the files, constraints and an example to follow.** A vague request gets a guess. Name the files to change, any limits (for example, "do not touch the billing code") and a similar piece of work to copy.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

3. **For bigger work, have Claude interview you and write the plan first; skip planning only when the change fits in one sentence.** Ask Claude to question you about what you want, then write the answers into `plan.md`, the planning file for a build (one thing being made), before any code. If you could describe the whole change in one sentence, such as fixing a typo, just ask for it.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices); Foundation 2

4. **One task per session; after two failed corrections, start fresh with a better prompt.** Claude's working memory of a session fills up with old attempts, and answers get worse. Start a new session for each task. If you have corrected Claude twice on the same point, stop, start a new session and put what you learned into the first message.
   Source: [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

5. **Put repeatable procedures in a skill, not in a prompt you retype.** A skill is a saved set of instructions that Claude follows when you ask for it by name, such as `/new-build`. It gives the same steps every time and saves you the typing.
   Source: [Claude Code skills](https://code.claude.com/docs/en/skills); [Nicholas Dulait, post on X](https://x.com/NicholasDulait/status/2108212094214529135) (sells ChatSEO)
