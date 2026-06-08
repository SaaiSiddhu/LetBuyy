# Git Hooks

Local hook scripts live here when they are governed by repository validators.

Hooks must be dependency-light, call existing scripts instead of duplicating checks,
and remain opt-in per clone through `git config core.hooksPath scripts/git-hooks`.
