#!/usr/bin/env bash
# Machine-switch sync check — run at session start by the memory protocol.
#
# What it does (all safe, all idempotent):
#   1. Repoints old clones still on `master` when the remote's default is `main`.
#   2. Ensures this checkout's git hooks are enabled (git's local config is not
#      cloned, so a fresh clone needs one bootstrap).
#   3. Fetches origin and fast-forwards to the latest memory files — but ONLY
#      when the working tree is clean, so it never clobbers uncommitted work.
#
# Assumes the remote default branch is `main` (edit the default below if not).
# Exits 0 always — this is a session-start convenience, never a failure gate.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MARKER="$ROOT/docs/.last-machine"
HOSTNAME="$(hostname 2>/dev/null || echo unknown)"
BRANCH="$(git branch --show-current 2>/dev/null || echo '')"

echo "=== Machine sync check ==="

# 1. Old-clone fix: local branch still named master, remote has main
if [ "$BRANCH" = "master" ] && git ls-remote --heads origin main >/dev/null 2>&1; then
  echo "→ Detected old 'master' clone — renaming to 'main' (remote default)..."
  git branch -m master main 2>/dev/null
  git branch --set-upstream-to=origin/main main 2>/dev/null || true
  BRANCH="main"
fi
[ -z "$BRANCH" ] && BRANCH="main"

# 2. Machine change detection and hook bootstrap
PREV=""
[ -f "$MARKER" ] && PREV="$(cat "$MARKER" 2>/dev/null || true)"
if [ -n "$PREV" ] && [ "$PREV" != "$HOSTNAME" ]; then
  echo "→ Machine change detected: '$PREV' → '$HOSTNAME'"
fi

# Git's local config is not cloned from GitHub, so a brand-new clone has no
# core.hooksPath yet. Bootstrap whenever this checkout is not already wired to
# the committed hooks; this makes first use work on every supported machine.
HOOKS_PATH="$(git config --local --get core.hooksPath 2>/dev/null || true)"
if [ "$HOOKS_PATH" != ".githooks" ]; then
  echo "→ Enabling committed memory hooks for this checkout..."
  bash "$ROOT/scripts/setup-memory-hooks.sh" >/dev/null 2>&1 || echo "  (bootstrap skipped — check scripts exist)"
fi

mkdir -p "$(dirname "$MARKER")"
echo "$HOSTNAME" > "$MARKER"

# 3. Fetch + pull latest when safe
git fetch origin --quiet 2>/dev/null || echo "→ Warning: could not fetch from origin (offline?)."
BEHIND="$(git rev-list --count HEAD..origin/"$BRANCH" 2>/dev/null || echo 0)"
DIRTY="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

if [ "${BEHIND:-0}" -gt 0 ] 2>/dev/null; then
  if [ "$DIRTY" = "0" ]; then
    echo "→ Local is $BEHIND commit(s) behind origin/$BRANCH. Pulling latest..."
    git pull --ff-only origin "$BRANCH" 2>&1 || echo "→ Pull failed — resolve manually."
  else
    echo "→ Local is $BEHIND commit(s) behind, but working tree is dirty — NOT auto-pulling."
    echo "  Commit or stash first, then run: git pull"
  fi
else
  echo "→ Up to date with origin/$BRANCH."
fi

echo "=== Machine sync check done ==="
