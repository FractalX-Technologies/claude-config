# How I work

For a session with me at the keyboard. It adds to *How work is done*.

## About me

My stack, projects, machine and the language to answer me in live in `~/.claude/personal.md`, outside the shared
config. It is loaded after this file.

## Decisions

- Before the first edit of each task (a feature, a fix, a refactor, a session's work), ask once with
  `AskUserQuestion`, both questions in one call: **careful** or **automatic**? **With tests** or **without tests**?
  Don't ask what my message or a handoff already names, for read-only work (questions, searches, reviews), or in a
  subagent or a run nobody answers: those are automatic, with tests.
- **Careful**: the `flow-slices` skill. Each slice is built, tested and reviewed, then waits for my OK before its
  commit and before the next slice starts. It wins over every "without asking" in these rules; "automatic" at a
  gate switches the rest of the task to automatic.
- **Automatic** (also my "no"): don't ask me to confirm plans, scope or ordinary decisions: pick what a senior
  colleague would pick, do the work, and state the assumption in one line so I can push back. Ask only at a real
  fork, where both options are defensible and the choice is mine.
- **Without tests**: a quick change I try myself. Write and run no tests (unit, e2e, Maestro); build every affected
  platform and install it where I'll try it (device or simulator; a phone: the `flow-device` skill). Never weaken or
  delete an existing test, and CI still runs them. The task gets one waiver in `tasks/waivers.md` ("the owner chose
  without tests"). **With tests** is the shared rules' default.
- In both modes, hard-to-reverse or outward-facing actions (deleting, releasing, sending data out) and anything
  company policy requires are confirmed first. `git` and `gh` are the exception: § Git.

## My machine

- I run the apps myself (`npm run dev`, `dotnet run`, docker compose) while you work. Don't stop them or build
  into their output folders: use another configuration and a free port, and ask before `docker compose up` (it
  recreates my containers). Before moving, renaming or deleting a project folder, check `ps`/`lsof` for a live
  process.
- A UI suite that takes this Mac's keyboard and screen (XCUITest on a Mac app) runs only for the screens the change
  touches, after saying how long it will hold them. Ask before the whole suite, and write what it left unrun as owed
  in `tasks/waivers.md`.

## Git

- **Commit only after I've tried it.** When a change is done: build it, install it where I try it (device,
  simulator or browser), say what to try, and stop. Commit and push once I say it's fine. A night run
  (`flow-sweet-dreams`) commits each phase on its branch, since nobody is there to try it.
- A change to the global config (`~/.claude-config`: rules, skills, agents, hooks, this file) has nothing to try:
  commit and push it to `main` as soon as it's made, from any session, whatever repo that session is in.
- Past that OK, run `git` and `gh` without asking, on any branch, `main` included: commit, push, merge, rebase, pull
  requests and every other `gh` write.
- Other sessions share my checkouts. Run `git status -sb` right before every `switch`, `commit` or `push`, and
  start new work in a worktree off `main`. Orca creates it, in its own workspace folder outside the repo
  (`orca worktree create --repo path:<repo> --name <topic> --base-branch main`); where Orca isn't running,
  `git worktree add -b <branch> ../<repo>-<topic> main`.
- Once a pull request is finished and tested (suites green, CI and review handled), merge it to `main` yourself, in
  the repo's merge style, and start the next work in a new worktree off the updated `main`. One pull request at a
  time: never branch off one that isn't merged. A merge that deploys production is a release: ask first.
