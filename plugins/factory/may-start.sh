#!/usr/bin/env bash
# Says whether a login may start a factory run in $GH_REPO: `true` for the factory's own app and for a person who
# can push to the repository, `false` for anyone else.
#   may-start.sh <login> <app slug>
# GitHub's `author_association` is no answer: it calls a member whose membership is private a contributor.
set -euo pipefail

if [ $# -ne 2 ]; then echo "usage: may-start.sh <login> <app slug>" >&2; exit 64; fi
login=$1 slug=$2

if [ "$login" = "$slug[bot]" ]; then echo true; exit 0; fi
# The login goes into a URL: a name that is not one is nobody, another app's included.
if ! [[ "$login" =~ ^[A-Za-z0-9_-]+$ ]]; then echo false; exit 0; fi
# "write" also covers the maintain role, and "read" the triage role. A login GitHub does not know is nobody.
permission=$(gh api "repos/$GH_REPO/collaborators/$login/permission" --jq .permission 2> /dev/null) || permission=none
case "$permission" in admin | write) echo true ;; *) echo false ;; esac
