---
name: think-grill
description: Interview the user in rounds about a plan, design or decision until nothing is left assumed, each question with a recommended answer. Use only when the user asks for it ("grill me", "grílame", "hazme preguntas sobre el plan", "stress-test this by asking me").
---

# Grilling

Reach a shared understanding by questioning, not by guessing. Map the plan as a **design tree**: each decision
branches into the decisions that hang off it.

## Rounds

The **frontier** is every open decision whose prerequisites are settled: the questions you can ask now without
guessing an answer you haven't heard. Ask the whole frontier in one round, then wait.

- Number each question and give your recommended answer, worded so "sí" accepts it.
- A question with 2–4 clear options: use `AskUserQuestion` (up to 4 per call, recommended option first). Otherwise:

  ```
  ❓ **P1. <title>**: <the question, with its options>
  ➡️ <recommended answer, and why in one line>
  ```

- A question that depends on another one still open belongs to the next round.
- Each round's answers move the frontier: recompute it and ask the next round.
- In the user's language.

## Facts are yours, decisions are theirs

Never ask the user something you can find: read the code, the rules, `tasks/`, git history. Look it up before the
round, and ask only the questions that don't depend on it while you look. Every **decision** goes to the user.

## Done

**Done when** the frontier is empty: every branch visited, nothing silently assumed. Then:

1. Write the settled decisions into the plan (`tasks/todo.md`) and anything still open under `## Open decisions`.
2. Summarize the decisions in a few lines and ask whether that's the shared understanding.
3. Act only after the user confirms.
