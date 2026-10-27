---
name: delegation
description: >-
  Use when deciding whether to delegate, splitting substantial work into subtasks or parallel agents, or integrating delegated output. Covers when to fan out, what the primary agent keeps, treating delegated output as unverified, and isolating parallel file changes.
---
<!-- gh-repo-bootstrapper: template-owned; sha256=badd09163e06cac472db3d0db6cd9e97d7659c76ec3de7b94f7a7d6112e6c512 -->

# Orchestration and delegation

When delegation capabilities are available and substantial work would benefit
from independent execution, specialization, parallelism, or context
management, delegate bounded subtasks. Handle small or tightly coupled changes
directly instead of creating unnecessary fan-out.

The primary agent remains responsible for architecture, decomposition,
coordination, difficult decisions, integration, review of delegated work, and
final verification. Treat delegated output as unverified until it has been
integrated, reviewed as appropriate, and validated against this repository's
requirements.

For parallel tasks that may modify files, use isolated workspaces or worktrees
when supported; otherwise sequence the changes so one agent owns each mutable
area.
