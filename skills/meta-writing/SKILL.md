---
name: meta-writing
description: How to write what an agent reads - CLAUDE.md, AGENTS.md, rules, skills, subagents and hook messages. Use when creating or editing any of them, or adopting a third-party skill.
---

# Writing for agents

The agent follows the same **process** every run only if the document makes that process obvious. The levers below
are what make it obvious.

## 1. Pick the type

| It must… | Type |
|---|---|
| hold every time, whether Claude remembers or not | hook (code, it can block) |
| apply to every session in every repo | `~/.claude/CLAUDE.md`: a few lines |
| apply while working on certain files | rule: `rules/<stack>/RULE.md` + `references/*.md`, each with `paths:` |
| be a procedure or knowledge used now and then | skill |
| run apart, with its own context and tools, and return only a result | subagent |

Claude Code loads **every** `.md` under `rules/`: a reference without `paths:` is always loaded. Only `RULE.md` of
`shared/` goes without it, on purpose.

Names: skills start with `code-` (a language or stack), `flow-` (a work process), `think-` (questioning a plan) or
`meta-` (writing this config); agents with `review-`. Short, lowercase, hyphens.

## 2. The pointer decides when it fires

A skill or agent `description`, a line in CLAUDE.md that names a file, a row in a RULE.md table: each is a pointer
that stays in context. Its **wording**, not the target, decides when the material is reached.

- Lead with what it is, then one trigger per distinct case. Synonyms for the same case are one trigger written twice.
- Use the words the user really types, Spanish ones included ("limpia este archivo", "nueva sesión").
- Short: every always-loaded word costs on every turn. The detail goes in the body.
- A skill only ever started by hand: `disable-model-invocation: true`, and its description becomes a one-line summary
  for the human.

## 3. Disclose detail behind pointers

- Top of the file: the steps, or the rules that never break (about 10). Detail that only some cases need goes to
  `references/`, with a pointer that says when to read it.
- Keep a concept's rule, reason and exception under one heading, not spread across files.
- A file too long to keep relevant is the failure: split it by case or by sequence.

## 4. Steps end on "done when"

Each step has a criterion the agent can check: "the loop is red on this bug", "every touched file listed". A vague one
("understand the code") invites stopping early. Demanding criteria ("every …") make the agent do the legwork.

## 5. Words

- **Leading words**: one strong, familiar word repeated beats a sentence restated (_red_, _seam_, _slice_, _handoff_).
- **Say what to do.** "Comments say why, in a few lines" works better than "don't write long comments". Keep a "never"
  for hard guardrails, next to what to do instead.
- Simple and generic: short sentences, one idea per bullet, no company, app, repo or package names in global files
  (those go in CLAUDE.md § Stack or in the project's own files). English.
- A ✓ / ✗ example pair beats a paragraph.

## 6. One home per fact

- Each rule lives in one place; everything else links to it. Two copies drift, and then contradict.
- Don't restate what the repo already says (scripts in `package.json`, the folder layout, `--help`): that copy goes
  stale. Write what can't be found by looking: the reason, the trap, the convention nobody wrote down.
- Delete sentences that change nothing: what the model already does by default.

## 7. Live in harmony

- A skill never contradicts a rule. Where a third-party skill differs, add a **Project overrides** section near the
  top ("the project's rules win where they differ"), and fix its examples that would mislead (installs, old APIs).
- Third-party skills: read them first; drop scripts and commands that run on load, `allowed-tools` that pre-approve
  installs, and anything that sends data out.
- Before calling a rule done, check it against the real code of the repos it covers: versions, folder names, APIs.

**Done when** the type fits the table, every pointer says when, nothing in it is said elsewhere, and nothing
contradicts a rule.
