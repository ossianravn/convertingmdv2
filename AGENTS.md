# AGENTS.md

## Product

This repository is ConvertingMD, an open-source markdown conversion service built on Cloudflare Workers AI and Browser Run. It provides a REST API for converting markdown content to various formats, with features like auth, quota management, caching, and more.

Keep the worktree clean: https://github.com/ossianravn/convertingmdv2.git

## Where Codex should start

Read .dev-docs/converting-md-prd-split/00-index.md first. The PRD is intentionally split into files under 220 lines so Codex can read each file reliably. Do not rely on heuristics or partial search across the whole PRD.

## Always work modularly
IMPORTANT!: When adding new features or fixing bugs, break down the work into small, manageable modules. This makes it easier to test and review changes. This also means that we shouldnt have files larger than 300 lines of code. Do NOT line-squeeze to get under a LOC limit; instead split by responsibility!

## NEVER USE GIT CHECKOUT WITHOUT CONFIRMATION FROM THE USER
Under no circumstances should you use `git checkout` to switch branches or revert changes without explicit confirmation from the user. Always ask for permission before performing any actions that could alter the current working state or lead to potential data loss.

## NEVER EDIT THIS FILE WITHOUT USER CONFIRMATION!
Do not make any changes to this file unless you have explicit confirmation from the user. This file contains critical guidelines for agent behavior and must be maintained with care.

## NEVER RESET THE DATABASE WITHOUT USER CONFIRMATION!
Avoid resetting or modifying the database unless you have explicit confirmation from the user. Any changes to the database can lead to data loss or corruption, so always seek permission before proceeding. Breaching this rule may lead to severe consequences, including termination of your access to the repository.

## Important
- Write code as if Linus Torvalds is looking over your shoulder!!!
- Create a feedback loop for yourself. Make sure you have the logging and testing in place to quickly identify and fix any issues that arise. Do not wait for the user to report bugs; proactively monitor and address them!
- Run smoke tests and sanity checks before pushing any code! Do not push code that you have not tested yourself! If you are unsure about the stability of your code, ask for help or review before pushing!
- Measure twice cut once 
- Build modular first. No files longer than 300 lines of code!
- Do not limit yourself due to the LOC limit! If a task requires more code, split it into multiple files/modules/functions!! And even better when you prepare for future changes by making the code modular from the start. Do not assume that the first version is the last version!
- Do not add fallbacks during development. Is something fails, let it fail, so we can fix it!
- Do not leave empty try-catch blocks anywhere! 
- Use your planning tool and remember to update plans as you progress.
- Ask questions if anything is unclear! The user wants you to succeed, so ask for clarifications if needed. Your goal is not to guess, but to be sure!

## Continuity Ledger (compaction-safe)
Maintain a single Continuity Ledger for this workspace in `CONTINUITY.md`. The ledger is the canonical session briefing designed to survive context compaction; do not rely on earlier chat text unless it’s reflected in the ledger.

### How it works
- At the start of every assistant turn: read `CONTINUITY.md`, update it to reflect the latest goal/constraints/decisions/state, then proceed with the work.
- Update `CONTINUITY.md` again whenever any of these change: goal, constraints/assumptions, key decisions, progress state (Done/Now/Next), or important tool outcomes.
- Keep it short and stable: facts only, no transcripts. Prefer bullets. Mark uncertainty as `UNCONFIRMED` (never guess).
- If you notice missing recall or a compaction/summary event: refresh/rebuild the ledger from visible context, mark gaps `UNCONFIRMED`, ask up to 1–3 targeted questions, then continue.

### `functions.update_plan` vs the Ledger
- `functions.update_plan` is for short-term execution scaffolding while you work (a small 3–7 step plan with pending/in_progress/completed).
- `CONTINUITY.md` is for long-running continuity across compaction (the “what/why/current state”), not a step-by-step task list.
- Keep them consistent: when the plan or state changes, update the ledger at the intent/progress level (not every micro-step).

### In replies
- Begin with a brief “Ledger Snapshot” (Goal + Now + Next + Open Questions). Print the full ledger only when it materially changes or when the user asks.

### `CONTINUITY.md` format (keep headings)
- Goal (incl. success criteria):
- Constraints/Assumptions:
- Key decisions:
- State:
  - Done:
  - Now:
  - Next:
- Open questions (UNCONFIRMED if needed - you can be more verbose here, so the user is qualified to answer!):
- Working set (files/ids/commands):