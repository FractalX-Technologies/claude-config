---
name: meta-skill-updates
description: Check the skills this config adopted from other authors against their sources, and bring a newer version in with the config's own changes kept. Use when the user asks whether a skill has an update ("is there a skill to update?", "check the third-party skills") or asks to update one ("update diagram-design").
---

# Updating adopted skills

An adopted skill is a copy: nothing brings its author's changes in until someone asks. The copy records where it
came from in its frontmatter, and its **source commit** is what every step compares against.

```yaml
metadata:
  source: https://github.com/<owner>/<repo>
  source-path: skills/<name>     # the skill's folder in that repo
  source-commit: <40 hex>        # the commit the copy was taken at
```

## Steps

1. **Check.** Run `check.sh` from this skill's folder: it asks each source through `gh` and writes nothing. Report
   every line as it is:
   - `current`: nothing to do.
   - `update`: the link is the source's diff since the copy.
   - `unknown`: a skill with a license and no source recorded. Ask the user for its repository and record the three
     fields first. With no known commit, take the source's last one before the copy's first commit here, and say it
     is a guess.
   - `error`: the source could not be asked. Say so, never report it as current.

   Done when every line is reported. No `update` → stop here.
2. **Read what changed**, before copying anything. In a scratch folder:

   ```bash
   git clone --filter=blob:none <source> <name> && cd <name>
   git diff <source-commit> <latest> -- <source-path>
   ```

   What an adopted skill may not bring is in `meta-writing` § 7. Done when every changed script and every new file
   is read, and what § 7 refuses is listed to drop.
3. **Merge**, so the config's changes survive. In the same clone:

   ```bash
   git switch -c ours <source-commit>
   git rm -rq <source-path> && mkdir -p "$(dirname <source-path>)"
   cp -R <the copy's folder in this config> <source-path>
   git add -A && git commit -qm ours
   git merge <latest>
   ```

   - The merge takes the author's changes and keeps the config's (Project overrides, reworded lines). A conflict is
     a line both changed: keep the config's meaning in the author's new text. The frontmatter `description` is the
     config's: keep it, and add a case the author added only if a user would ask for it by name.
   - Copy the merged folder back over the copy. A file the copy took from outside the folder (a license) is copied
     again from `<latest>`.

   Done when no conflict marker is left and the config's `git diff` shows the author's changes with every override
   still in place.
4. **Record.** Set `source-commit` to `<latest>` and `version` to the source's. Done when `check.sh` says `current`.
5. **Prove.** The config's suite, as its CI runs it, is green. A line the content test refuses is reworded in the
   copy, never in the test.
6. **Commit** as `chore(skills): update <name> to <version>`, and tell the user what the author changed in a few
   bullets, with what was dropped or kept differently.
