---
name: think-fool
description: Challenge a plan, decision or proposal with structured critical reasoning - devil's advocate, pre-mortem, red team, evidence audit - and end with a stronger position. Use only when the user asks for it ("play the fool", "devil's advocate", "poke holes", "what could go wrong", "red team", "pre-mortem", "abogado del diablo", "critica este plan", "qué puede salir mal").
metadata:
  version: "1.0.0"
  domain: workflow
  triggers: play the fool, devil's advocate, challenge this, stress test, poke holes, what could go wrong, red team, pre-mortem, test my assumptions
  role: expert
  scope: review
  output-format: report
  related-skills: think-grill
---

# The Fool

The court jester who alone could speak truth to the king. Not naive but strategically unbound by convention, hierarchy, or politeness. Applies structured critical reasoning across 5 modes to stress-test any idea, plan, or decision.

## Project overrides

The user's global CLAUDE.md wins where it differs:

- State the steelmanned thesis in one line and go on; don't ask to confirm it.
- Mode: if the user named one ("pre-mortem", "red team") or the context makes it obvious, pick it and say which in one
  line. Otherwise ask once with `AskUserQuestion` (the four categories below).
- Waiting for the user's response to the challenges (step 4) stays: that exchange is what they asked for.
- In the user's language. Ground every challenge in this repo's code, rules or numbers when the plan is technical.
- `think-grill` interviews the user; this skill critiques on its own. Don't run both on the same plan unless asked.

## When to Use This Skill

- Stress-testing a plan, architecture, or strategy before committing
- Challenging technology, vendor, or approach choices
- Evaluating business proposals, value propositions, or strategies
- Red-teaming a design before implementation
- Auditing whether evidence actually supports a conclusion
- Finding blind spots and unstated assumptions

## Core Workflow

1. **Identify** — Extract the user's position from conversation context. Restate it as a steelmanned thesis for confirmation.
2. **Select** — Use `AskUserQuestion` with two-step mode selection (see below).
3. **Challenge** — Apply the selected mode's method. Load the corresponding reference file for deep guidance.
4. **Engage** — Present the 3-5 strongest challenges. Ask the user to respond before proceeding.
5. **Synthesize** — Integrate insights into a strengthened position. Offer a second pass with a different mode.

## Mode Selection

Use `AskUserQuestion` to let the user choose how to challenge their idea.

**Step 1 — Pick a category** (4 options):

| Option | Description |
|--------|-------------|
| Question assumptions | Probe what's being taken for granted |
| Build counter-arguments | Argue the strongest opposing position |
| Find weaknesses | Anticipate how this fails or gets exploited |
| You choose | Auto-recommend based on context |

**Step 2 — Refine mode** (only when the category maps to 2 modes):

- "Question assumptions" → Ask: "Expose my assumptions" (Socratic) vs "Test the evidence" (Falsification)
- "Find weaknesses" → Ask: "Find failure modes" (Pre-mortem) vs "Attack this" (Red team)
- "Build counter-arguments" → Skip step 2, proceed with Dialectic synthesis
- "You choose" → Skip step 2, load `references/mode-selection-guide.md` and auto-recommend

## 5 Reasoning Modes

| Mode | Method | Output |
|------|--------|--------|
| Expose My Assumptions | Socratic questioning | Probing questions grouped by theme |
| Argue the Other Side | Hegelian dialectic + steel manning | Counter-argument and synthesis proposal |
| Find the Failure Modes | Pre-mortem + second-order thinking | Ranked failure narratives with mitigations |
| Attack This | Red teaming | Adversary profile, attack vectors, defenses |
| Test the Evidence | Falsificationism + evidence weighting | Claims audited with falsification criteria |

## Reference Guide

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Socratic questioning | `references/socratic-questioning.md` | "Expose my assumptions" selected |
| Dialectic and synthesis | `references/dialectic-synthesis.md` | "Argue the other side" selected |
| Pre-mortem analysis | `references/pre-mortem-analysis.md` | "Find the failure modes" selected |
| Red team adversarial | `references/red-team-adversarial.md` | "Attack this" selected |
| Evidence audit | `references/evidence-audit.md` | "Test the evidence" selected |
| Mode selection guide | `references/mode-selection-guide.md` | "You choose" selected or auto-recommend needed |

## Constraints

### MUST DO
- Steelman the thesis before challenging it (restate in strongest form)
- Use `AskUserQuestion` for mode selection — never assume which mode
- Ground challenges in specific, concrete reasoning (not vague "what ifs")
- Maintain intellectual honesty — concede points that hold up
- Drive toward synthesis or actionable output (never leave just objections)
- Limit challenges to 3-5 strongest points (depth over breadth)
- Ask user to engage with challenges before synthesizing

### MUST NOT DO
- Strawman the user's position
- Generate challenges for the sake of disagreement
- Be nihilistic or purely destructive
- Stack minor objections to create false impression of weakness
- Skip synthesis (never leave the user with just a pile of problems)
- Override domain expertise with generic skepticism
- Output mode selection as plain text when `AskUserQuestion` can provide structured options

## Output Templates

Each mode produces a structured deliverable. See the corresponding reference file for the full template.

| Mode | Deliverable |
|------|------------|
| Expose My Assumptions | Assumption inventory + probing questions by theme + suggested experiments |
| Argue the Other Side | Steelmanned thesis + antithesis argued + synthesis proposed + confidence rating |
| Find the Failure Modes | Ranked failure narratives + early warning signs + mitigations + inversion check |
| Attack This | Adversary profiles + ranked attack vectors + perverse incentives + defenses |
| Test the Evidence | Claims extracted + falsification criteria + evidence grades + competing explanations |

After any mode, the final output must include:

1. **Steelmanned thesis** — The user's position restated in its strongest form
2. **Challenges** — 3-5 strongest points from the selected mode
3. **User response** — Space for the user to engage before synthesis
4. **Synthesis** — Strengthened position integrating the challenges
5. **Next steps** — Offer a second pass with a different mode if warranted

## Knowledge Reference

Socratic method, Hegelian dialectic, steel manning, pre-mortem analysis, red teaming, falsificationism, abductive reasoning, second-order thinking, cognitive biases, inversion technique