# Lessons Learned & Error Log

**Purpose:** A permanent, structured record of mistakes, errors, gotchas, project issues, and fixes. The goal: never repeat a lesson.

## How this file stays up to date (automatic)
1. **Git hook safety net:** `.githooks/post-commit` auto-appends an "(auto-captured, needs enrichment)" placeholder for every commit whose message mentions fix/bug/error/regression/etc.
2. **Agent ritual (mandatory, immediate):** the session protocol in `knowledge.md`/`AGENTS.md` requires appending a full entry immediately whenever an error is fixed, a mistake is made, or a gotcha is discovered.
3. **Session-end sweep:** the agent expands auto-captured placeholders with root cause + "avoid in future" and removes the enrichment marker.

## Entry format
- **Symptom:** what went wrong or the error observed
- **Root cause:** why it happened
- **Fix:** what was changed to resolve it
- **Avoid in future:** the actionable rule to prevent recurrence
- **Status:** `fixed` | `workaround` | `open`

---

## 2026-08-25 — repo setup (example seeded lesson)
- **Symptom:** no git repo, no AI memory system, no GitHub remote wired up.
- **Root cause:** project started as a docs-only folder; version control and cross-session memory were never initialized.
- **Fix:** `git init -b main`, added `origin` → `https://github.com/connorpaps/echoforge-3d.git`, installed the full MEMORY_SETUP.md memory system (knowledge/handoff/lessons/activity-log, post-commit hook, setup + machine-sync + watcher scripts), and pushed the initial commit.
- **Avoid in future:** run the `knowledge.md` bootstrap check (`git config core.hooksPath`) at the start of every session, especially after cloning on a new machine.
- **Status:** fixed
