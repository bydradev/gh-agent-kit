---
name: worktrees-and-scratch
description: >-
  Use before creating a git worktree, verification copy, or temporary file, running checks in an isolated tree, or finishing a task that created any of these. Covers verifying in place, where worktrees live, reusing one worktree per purpose, shared build caches, scratch directories, and cleanup.
---
<!-- gh-repo-bootstrapper: template-owned; sha256=d4205735cf3f995c36efaa95d489144fe249ef62c207089ca819b32ab335b847 -->

# Worktrees, verification copies, and scratch output

Disk is shared by every agent session on the machine, and nothing cleans up
after a session ends. Anything a task creates outside the tracked tree belongs
to that task, and removing it is part of the task.

- **Verify in place first.** Run checks in the working tree when it reflects
  the change under test. When an isolated tree is genuinely needed (a
  clean-tree qualification, a mutation run, a comparison between commits), use
  `git worktree add --detach`. Never copy a checkout with `cp -R`, `rsync`, or
  similar: that duplicates installed dependencies and build output, and a
  worktree starts from tracked files only.
- **Keep worktrees outside the checkout, in one place per repository**, such as
  `../.worktrees/<repo>/<purpose>` next to the clone. A worktree nested inside
  the checkout is picked up by test discovery, type-checking, file watchers,
  and search. When a harness manages its own worktree location, use that.
- **Reuse one worktree per purpose** across runs: check out the next commit in
  it rather than adding a worktree per run, per commit, or per reviewer. When a
  run needs a pristine tree, clean a worktree this task created rather than
  creating another. In a worktree you did not create, remove only output you
  can identify as this task's, and report anything else instead of cleaning it.
- **Keep build caches shared, not multiplied.** Where this repository's Tooling
  guidance (the `AGENTS.md` Tooling section or a `local-validation-<type>`
  skill) says where a worktree's dependencies and build output live, follow it; otherwise keep
  them inside that worktree so they are removed with it.
- **Put temporary files in the session's scratch directory** when the harness
  provides one, otherwise in a `mktemp -d` directory, never at fixed paths in
  `/tmp`, in the checkout's parent directory, or in sibling folders next to it.
  Evidence that must outlive the session belongs where this repository
  documents it; otherwise summarize it in the report rather than leaving files
  behind.
- **Clean up before finishing.** Remove the worktrees you added with
  `git worktree remove`, then `git worktree prune`, and delete the scratch
  output you created. Remove only what this task created; report anything else
  you find rather than deleting it.
