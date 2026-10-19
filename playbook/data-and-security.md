# Data and security

> Copied from SMB-AI ([playbook/data-and-security.md](https://github.com/seppling/SMB-AI/blob/768425e/playbook/data-and-security.md), commit 768425e, Oct 18, 2026). Change it there, then copy it here again. See [README.md](README.md).

Data is the information a build uses, such as customer records, prices and orders. Security means keeping the wrong people and the wrong tools away from it. The repo is the folder that holds all of this project's files. A secret is a password, an access key or any other value that unlocks a system. These practices keep secrets safe and keep data usable.

## Practices

1. **Secrets live only in environment settings: never in files, prompts or chat.** Environment settings are a protected place, outside the code, where secrets are stored and handed to a program when it runs. The Twelve-Factor App offers a test: could you share the whole repo publicly without leaking a password? If not, a secret is in the wrong place.
   Source: [The Twelve-Factor App, Config](https://12factor.net/config); Foundation 5

2. **The repo blocks Claude from reading secret files (`.env`, `secrets/`).** A `.env` file is a common place to keep keys on a computer. Claude Code, the tool Claude works in, lets a repo list files that Claude may never read, and this repo's settings file, `.claude/settings.json`, lists the secret ones.
   Source: [Claude Code permissions](https://code.claude.com/docs/en/permissions)

3. **Read-only by default; connectors and keys are scoped to the job.** A connector is a link that lets Claude use another service, such as email or accounting software. Give each connector and key the least access that still does the job. If a key leaks or an agent is tricked, the damage stays small.
   Source: [Simon Willison, The lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/); [Lazy Leverage, We hosted an in-person AI event](https://lazyleverage.beehiiv.com/p/we-hosted-an-in-person-ai-event); Foundation 5

4. **Classify data before it reaches an AI service: customer and financial data stay in approved tools, and anything sent elsewhere is scrubbed first.** To classify means to sort data into tiers by how sensitive it is. Customer and financial records stay in tools you have approved. If something must go to another AI service, remove names, account numbers and other identifying details first (this is called scrubbing).
   Source: [Josh Schultz, three-tier security model for manufacturers' AI](https://joshuaschultz.com/knowledge-base/three-tier-security-model-manufacturers-ai/)

5. **Before building AI on data, find it, put it in one place, control access, keep it fresh, clean it, and document and validate it.** These six steps come from Mark Ajzenstadt's thread on AI-ready data. To validate means to check the documentation against the real data, and if the two disagree, the real data wins. AI built on old or messy data gives confident answers that are wrong.
   Source: [Mark Ajzenstadt, thread on AI-ready data](https://x.com/mardehaym/status/2108162891950256274) (sells data modernization work); Foundation 8
