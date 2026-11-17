#!/usr/bin/env bash
# Install or update the kit's files in a target repository.
#
#   ./install.sh /path/to/target-repo
#   ./install.sh --check /path/to/target-repo
#   ./install.sh --issue-forms=own /path/to/target-repo
#
# Copies every path in kit-manifest.txt from this clone to the same path in
# the target ("seed" paths only when the target lacks them), adds a
# .claude/skills/<name> symlink for each skill (creating .claude/skills
# when the target lacks it), writes the Work tracking block from
# docs/agents-md-block.md into the target's AGENTS.md between its markers
# (at the end of "## Project specifics" the first time), and writes
# .github/gh-agent-kit.lock with this clone's commit when that changed. It
# changes nothing else in the target: commit the result on a branch and
# open a pull request. Re-run from a newer clone to update; the diff of the
# kit's files is printed at the end.
#
# --check changes nothing: it prints what an install would do, with the
# same verbs, and exits 0 when the target is current, 1 when an install
# would change it and 2 when an install would be refused.
#
# --issue-forms=own leaves .github/ISSUE_TEMPLATE/ to the target: the kit's
# files there (its issue forms and config.yml) are not copied, updated or
# removed. The lock records the choice, so a later install keeps it until
# --issue-forms=kit, which installs the kit's forms again.
#
# A clone with uncommitted or untracked changes to kit files or to the
# manifest is refused, since the lock would name a commit the files do not
# match. KIT_ALLOW_DIRTY=1 installs anyway and records "dirty": true in the
# lock, for trying a change out.
set -euo pipefail

KIT_SOURCE="github.com/bydradev/gh-agent-kit"

kit=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
usage() {
  echo "usage: $0 [--check] [--issue-forms=kit|own] /path/to/target-repo" >&2
  exit 2
}
check=0
# kit or own from --issue-forms; empty takes the lock's choice.
forms=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) check=1 ;;
    --issue-forms=kit | --issue-forms=own) forms=${1#--issue-forms=} ;;
    -*) usage ;;
    *) break ;;
  esac
  shift
done
target=${1:-}
if [ -z "$target" ] || [ ! -d "$target" ] || [ "$#" -gt 1 ]; then
  usage
fi
# What an install changes in the target, counted for --check, which makes
# none of these changes.
changes=0
changed() {
  changes=$((changes + 1))
  echo "$1"
}
target=$(cd "$target" && pwd -P)
if ! target_top=$(git -C "$target" rev-parse --show-toplevel 2>/dev/null); then
  echo "error: $target is not a git repository" >&2
  exit 2
fi
target_top=$(cd "$target_top" && pwd -P)
if [ "$target_top" != "$target" ]; then
  echo "note: $target is inside the repository at $target_top; installing there" >&2
  target=$target_top
fi
if [ "$target" = "$(git -C "$kit" rev-parse --show-toplevel)" ]; then
  echo "error: the target is this clone" >&2
  exit 2
fi

paths=()
seeds=()
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue ;; esac
  seed=0
  case "$line" in "seed "*) seed=1; line=${line#seed } ;; esac
  case "$line" in /*|*..*|*' '*) echo "error: refusing manifest path $line" >&2; exit 2 ;; esac
  [ -f "$kit/$line" ] || { echo "error: $line is in the manifest but not in this clone" >&2; exit 2; }
  paths+=("$line")
  [ "$seed" -eq 0 ] || seeds+=("$line")
done < "$kit/kit-manifest.txt"

ref=$(git -C "$kit" rev-parse HEAD)
dirty=false
# The manifest is a kit file too (a seed marker is its content), and a
# listed file that is not tracked, ignored or not (git status leaves an
# ignored file out), is as uncommitted as a modified one.
untracked=""
for p in kit-manifest.txt docs/agents-md-block.md "${paths[@]}"; do
  git -C "$kit" ls-files --error-unmatch -- "$p" >/dev/null 2>&1 || untracked+="?? $p"$'\n'
done
modified=$(git -C "$kit" status --porcelain --untracked-files=no -- kit-manifest.txt docs/agents-md-block.md "${paths[@]}")
if [ -n "$untracked$modified" ]; then
  if [ "${KIT_ALLOW_DIRTY:-}" = "1" ]; then
    dirty=true
    echo "warning: this clone has uncommitted changes to kit files; the lock will say so" >&2
  else
    echo "error: this clone has uncommitted changes to kit files; commit them, or set KIT_ALLOW_DIRTY=1" >&2
    printf '%s%s\n' "$untracked" "$modified" | sed '/^$/d' >&2
    exit 2
  fi
fi

is_seed() { local p; for p in "${seeds[@]+"${seeds[@]}"}"; do [ "$p" = "$1" ] && return 0; done; return 1; }

# Write a kit file into the target by a new file and a rename, never into
# the existing one: a hard link to it elsewhere then keeps the old content
# and mode. Scripts are executable, the rest read-only for the group.
# chmod takes no "--": BSD chmod (macOS) reads one after the mode as a file
# name, and the temporary file's path is absolute, so it never starts with -.
put() {
  local tmp
  [ "$check" -eq 0 ] || return 0
  tmp=$(mktemp -- "$target/$(dirname "$1")/.gh-agent-kit.XXXXXX")
  if ! cp -- "$kit/$1" "$tmp" || ! case "$1" in *.sh) chmod 0755 "$tmp" ;; *) chmod 0644 "$tmp" ;; esac; then
    rm -f -- "$tmp"
    exit 1
  fi
  mv -f -- "$tmp" "$target/$1"
}

# A symlink anywhere on a managed path would send the copy outside the
# target, and a file where a directory is needed would stop the copy
# half way; refuse both before anything is written.
no_symlink_on() {
  local rel=$1 dir=$target part
  while [ -n "$rel" ]; do
    part=${rel%%/*}
    [ "$part" = "$rel" ] && rel="" || rel=${rel#*/}
    dir="$dir/$part"
    if [ -L "$dir" ]; then
      echo "error: $dir is a symlink; the kit does not write through symlinks" >&2
      exit 2
    fi
    if [ -n "$rel" ] && [ -e "$dir" ] && [ ! -d "$dir" ]; then
      echo "error: $dir exists and is not a directory; move it aside" >&2
      exit 2
    fi
  done
}


# Paths the previous install managed, from the lock, so one the manifest
# dropped is removed rather than left to run beside its replacement. A
# dropped seed file is the target's own by then and stays. The lock is a
# committed file anyone can edit, so an entry is trusted only when the
# manifest at the lock's own kit ref listed it, and that ref is a commit
# in the history of this clone's commit (any object this clone happens to
# hold, say from an untrusted branch, is not); whether it was a seed is
# read from that manifest, not from the lock's "seeds" list. Without such
# a ref, nothing is removed.
lock="$target/.github/gh-agent-kit.lock"
# Checked before the lock is read: a symlink there would be read through.
no_symlink_on .github/gh-agent-kit.lock
if [ -e "$lock" ] && [ ! -f "$lock" ]; then
  echo "error: $lock exists and is not a regular file; move it aside" >&2
  exit 2
fi
previous=()
previous_seeds=""
lock_forms=""
if [ -f "$lock" ]; then
  old_ref=$(sed -n 's/^  "ref": "\([0-9a-f]\{40\}\)",\{0,1\}$/\1/p' "$lock" | head -n 1)
  old_manifest=""
  if [ -n "$old_ref" ] && git -C "$kit" merge-base --is-ancestor "$old_ref" HEAD 2>/dev/null \
    && git -C "$kit" cat-file -e "$old_ref:kit-manifest.txt" 2>/dev/null; then
    old_manifest=$(git -C "$kit" show "$old_ref:kit-manifest.txt" | sed -n '/^#/d; /^$/d; p')
    previous_seeds=$(printf '%s\n' "$old_manifest" | sed -n 's/^seed //p')
    old_manifest=$(printf '%s\n' "$old_manifest" | sed 's/^seed //')
  else
    echo "note: the lock's kit ref ${old_ref:-(none)} is not in the history of this clone's commit; files the kit has since dropped are not removed (fetch the kit's history to enable that)" >&2
  fi
  while IFS= read -r line; do
    case "$line" in /*|*..*|'') continue ;; esac
    printf '%s\n' "$old_manifest" | grep -qxF -- "$line" || continue
    previous+=("$line")
  done < <(sed -n 's/^    "\([^"]*\)",\{0,1\}$/\1/p' "$lock")
  # The issue forms choice an earlier install recorded; a lock written
  # before the choice existed has none, and had the kit's forms.
  lock_forms=$(sed -n 's/^  "issue_forms": "\([^"]*\)",\{0,1\}$/\1/p' "$lock" | head -n 1)
  if [ -z "$lock_forms" ] && grep -q '"issue_forms"' "$lock"; then
    lock_forms="?"
  fi
fi
case "$forms:$lock_forms" in
  kit:* | own:*) ;;
  :kit | :own) forms=$lock_forms ;;
  :) forms=kit ;;
  *)
    echo "error: the lock's issue_forms is not \"kit\" or \"own\"; pass --issue-forms=kit or --issue-forms=own" >&2
    exit 2 ;;
esac
# With its own issue forms, the target's .github/ISSUE_TEMPLATE/ is its
# business: the kit's files there are left out of every step below, the
# lock included, and one an earlier install put there is not removed.
is_form() { case "$1" in .github/ISSUE_TEMPLATE/*) return 0 ;; esac; return 1; }
skipped=()
if [ "$forms" = own ]; then
  rest=()
  for p in "${paths[@]}"; do
    if is_form "$p"; then skipped+=("$p"); else rest+=("$p"); fi
  done
  paths=("${rest[@]+"${rest[@]}"}")
  rest=()
  for p in "${seeds[@]+"${seeds[@]}"}"; do
    is_form "$p" || rest+=("$p")
  done
  seeds=("${rest[@]+"${rest[@]}"}")
fi
# The entries to prune: previously managed, no longer in the manifest, and
# not a seed by the old manifest (a dropped seed is the target's own).
prune=()
kept_seeds=()
for p in "${previous[@]+"${previous[@]}"}"; do
  keep=0
  for q in "${paths[@]}"; do [ "$q" = "$p" ] && keep=1 && break; done
  [ "$keep" -eq 1 ] && continue
  if [ "$forms" = own ] && is_form "$p"; then
    continue
  fi
  if printf '%s\n' "$previous_seeds" | grep -qxF -- "$p"; then
    kept_seeds+=("$p")
  else
    prune+=("$p")
  fi
done
# .claude/skills is linked into only when it and .claude are directories
# of the target's own: through a symlink the links would land elsewhere.
skills_dir() {
  [ ! -L "$target/.claude" ] && [ ! -L "$target/.claude/skills" ] && [ -d "$target/.claude/skills" ]
}
# The Work tracking block: the lines of docs/agents-md-block.md from its
# start marker to its end marker, checked here so that a clone without one
# is refused before anything in the target changes.
block_start='<!-- gh-agent-kit:work-tracking:start -->'
block_end='<!-- gh-agent-kit:work-tracking:end -->'
block_file=$(mktemp)
new_agents=$(mktemp)
trap 'rm -f -- "$block_file" "$new_agents"' EXIT
sed -n "\|^$block_start\$|,\|^$block_end\$|p" "$kit/docs/agents-md-block.md" > "$block_file"
if [ "$(head -n 1 "$block_file")" != "$block_start" ] || [ "$(tail -n 1 "$block_file")" != "$block_end" ] \
  || [ "$(grep -cxF -- "$block_start" "$block_file")" -ne 1 ]; then
  echo "error: docs/agents-md-block.md has no single block between its markers" >&2
  exit 2
fi
# Every destination, the paths to prune and the lock are checked before
# anything is removed or copied, so a refusal leaves the target as it was.
for p in "${paths[@]}"; do
  no_symlink_on "$p"
  if [ -e "$target/$p" ] && [ ! -f "$target/$p" ]; then
    echo "error: $target/$p exists and is not a regular file; move it aside" >&2
    exit 2
  fi
done
for p in "${prune[@]+"${prune[@]}"}"; do
  no_symlink_on "$(dirname "$p")"
  # A directory at the path would fail rm -f part way through the prune.
  if [ -e "$target/$p" ] && [ ! -f "$target/$p" ] && [ ! -L "$target/$p" ]; then
    echo "error: $target/$p (a file the kit dropped) exists and is not a regular file; move it aside" >&2
    exit 2
  fi
done
for p in "${kept_seeds[@]+"${kept_seeds[@]}"}"; do
  echo "kept       $p (a seed file the kit no longer ships; it is yours)"
done
for p in "${prune[@]+"${prune[@]}"}"; do
  if [ -e "$target/$p" ] || [ -L "$target/$p" ]; then
    if [ "$check" -eq 0 ]; then
      rm -f -- "$target/$p"
      rmdir -p -- "$target/$(dirname "$p")" 2>/dev/null || true
    fi
    changed "removed    $p (no longer in the kit)"
  fi
  # Only the kit's own symlink goes with a dropped skill; a link of the
  # target's own, or a file, at that name stays.
  case "$p" in .agents/skills/*/SKILL.md)
    skills_dir || continue
    name=$(basename "$(dirname "$p")")
    link="$target/.claude/skills/$name"
    if [ -L "$link" ] && [ "$(readlink -- "$link")" = "../../.agents/skills/$name" ]; then
      [ "$check" -eq 1 ] || rm -f -- "$link"
      changed "removed    .claude/skills/$name"
    elif [ -L "$link" ] || [ -e "$link" ]; then
      echo "kept       .claude/skills/$name (not the kit's symlink; left as is)" >&2
    fi ;;
  esac
done

for p in "${skipped[@]+"${skipped[@]}"}"; do
  echo "skipped    $p (the target keeps its own issue forms)"
done
for p in "${paths[@]}"; do
  # mkdir -p, not install -d, which would reset an existing directory's mode.
  [ "$check" -eq 1 ] || mkdir -p -- "$target/$(dirname "$p")"
  if [ -e "$target/$p" ] && cmp -s -- "$kit/$p" "$target/$p"; then
    # Same content; a script that lost its mode is replaced for it.
    case "$p" in
      *.sh) if [ -x "$target/$p" ]; then echo "unchanged  $p"; else put "$p"; changed "updated    $p (made executable)"; fi ;;
      *) echo "unchanged  $p" ;;
    esac
  elif [ -e "$target/$p" ] && is_seed "$p"; then
    echo "kept       $p (seed file; the target's own copy stays)"
  elif [ -e "$target/$p" ]; then
    put "$p"
    changed "updated    $p"
  else
    put "$p"
    changed "added      $p"
  fi
done

# The block goes into the target's AGENTS.md. Between existing markers it
# replaces what is there; without markers it goes at the end of the
# "## Project specifics" section (the section keeps its stop-and-ask items
# first). Anything it cannot place safely is reported and left alone: no
# AGENTS.md (or a symlink or other non-file there), not exactly one such
# heading, markers that are not one start followed by one end, a fence
# still open where the block would go, or a "### Work tracking" section
# without markers, pasted by hand from an earlier release, whose
# repository lines a replacement could lose. Headings and markers inside
# fenced code do not count, a fence closing as CommonMark closes it. The
# rest of the file is kept byte for byte, its mode and a missing final
# newline included. Every such report counts as a change for --check,
# since the block is missing or out of date. kit-update-check.yml scans
# AGENTS.md the same way.
agents="$target/AGENTS.md"
agents_skip() {
  changes=$((changes + 1))
  echo "skipped    AGENTS.md (Work tracking block: $1)" >&2
}
# Prints, outside fenced code, each line's kind with its number: S (start
# marker), E (end marker), P ("## Project specifics"), W ("### Work
# tracking"), H (another heading of level one or two, ATX or setext);
# and, when the file ends inside a fence, its last line with kind F (an
# unclosed fence runs to the end, so no heading after it is seen either).
agents_scan() {
  awk -v s="$block_start" -v e="$block_end" '
    {
      l = $0
      sub(/^ ? ? ?/, "", l)
      c = substr(l, 1, 1)
      n = 0
      if (c == "`" || c == "~") while (substr(l, n + 1, 1) == c) n++
      rest = substr(l, n + 1)
      if (fence) {
        if (c == fc && n >= fl && rest ~ /^[ \t]*$/) fence = 0
        prev = ""
        next
      }
      if (n >= 3 && !(c == "`" && index(rest, "`"))) { fence = 1; fc = c; fl = n; prev = ""; next }
    }
    $0 == s { print NR, "S" }
    $0 == e { print NR, "E" }
    $0 == "## Project specifics" { print NR, "P" }
    $0 == "### Work tracking" { print NR, "W" }
    $0 != "## Project specifics" && /^ ? ? ?##?([ \t]|$)/ { print NR, "H" }
    # A setext heading takes in its whole paragraph, so it starts at the
    # first line of that paragraph, where the block must go before it.
    prev != "" && /^ ? ? ?(-+|=+)[ \t]*$/ { print pstart, "H"; prev = ""; next }
    # A paragraph line a setext underline can follow: not blank, an ATX
    # heading, indented code (four spaces or a tab, unless it continues a
    # paragraph), or in a list item or a quote (from its marker to the
    # next blank line, so a continuation line counts as part of it).
    /^[ \t]*$/ { inlist = 0 }
    /^ ? ? ?(>|[-*+][ \t]|[0-9]+[.)][ \t])/ { inlist = 1 }
    {
      para = !(inlist || /^[ \t]*$/ || /^ ? ? ?#/ || (prev == "" && /^ ? ? ?(    |\t)/))
      if (para && prev == "") pstart = NR
      prev = para ? $0 : ""
    }
    END { if (fence) print NR, "F" }
  ' "$agents"
}
# Writes $1 over AGENTS.md, keeping its mode (cp -p) and, when it had
# none, its missing final newline. Nothing in check mode.
agents_write() {
  local tmp
  [ "$check" -eq 0 ] || return 0
  tmp=$(mktemp -- "$target/.gh-agent-kit.XXXXXX")
  if ! cp -p -- "$agents" "$tmp" || ! cat -- "$1" > "$tmp"; then
    rm -f -- "$tmp"
    exit 1
  fi
  mv -f -- "$tmp" "$agents"
}
# awk ends every line with a newline: drop the last one when AGENTS.md
# had none, so that only the block's lines change.
agents_newline() {
  if [ -s "$agents" ] && [ -n "$(tail -c 1 -- "$agents")" ]; then
    printf '%s' "$(cat -- "$new_agents")" > "$new_agents.tmp" && mv -f -- "$new_agents.tmp" "$new_agents"
  fi
}
if [ -L "$agents" ] || [ ! -f "$agents" ]; then
  agents_skip "no AGENTS.md file; add the block from the kit's docs/agents-md-block.md by hand"
else
  scan=$(agents_scan)
  kinds() { printf '%s\n' "$scan" | awk -v k="$1" '$2 == k { print $1 }'; }
  starts=$(kinds S); ends=$(kinds E); specifics=$(kinds P); open_fence=$(kinds F)
  if [ -n "$starts$ends" ]; then
    if [ "$(printf '%s\n' "$starts" | wc -l)" -ne 1 ] || [ "$(printf '%s\n' "$ends" | wc -l)" -ne 1 ] \
      || [ -z "$starts" ] || [ -z "$ends" ] || [ "$starts" -ge "$ends" ]; then
      agents_skip "its markers are not one start followed by one end; fix them by hand"
    else
      awk -v a="$starts" -v b="$ends" -v f="$block_file" '
        NR == a { while ((getline l < f) > 0) print l }
        NR >= a && NR <= b { next }
        { print }
      ' "$agents" > "$new_agents"
      agents_newline
      if cmp -s -- "$agents" "$new_agents"; then
        echo "unchanged  AGENTS.md (Work tracking block)"
      else
        agents_write "$new_agents"
        changed "updated    AGENTS.md (Work tracking block)"
      fi
    fi
  elif [ "$(printf '%s\n' "$specifics" | grep -c .)" -ne 1 ]; then
    agents_skip "no single \"## Project specifics\" heading to put it under"
  elif [ -n "$(kinds W)" ]; then
    agents_skip "a \"### Work tracking\" section without the kit's markers; move this repository's own lines to a subsection of their own, delete the section and install again"
  else
    # The first heading of level one or two after Project specifics ends
    # it; a fence still open there, or at the end of the file, would take
    # the block into code.
    next_h=$(printf '%s\n' "$scan" | awk -v p="$specifics" '$2 == "H" && $1 > p { print $1; exit }')
    if [ -n "$open_fence" ] && [ -z "$next_h" ]; then
      agents_skip "a fenced code block in \"## Project specifics\" is never closed; close it and install again"
    else
      awk -v at="${next_h:-0}" -v f="$block_file" '
        function emit(  l) {
          if (last != "") print ""
          while ((getline l < f) > 0) print l
          done = 1
        }
        NR == at { emit(); print "" }
        { print; last = $0 }
        END { if (!done) emit() }
      ' "$agents" > "$new_agents"
      agents_newline
      agents_write "$new_agents"
      changed "added      AGENTS.md (Work tracking block)"
    fi
  fi
fi

# Claude Code discovers skills under .claude/skills; bootstrapped
# repositories symlink that directory's entries to .agents/skills, where
# other agents find them. A target without the directory gets one.
if [ -L "$target/.claude" ] || [ -L "$target/.claude/skills" ]; then
  echo "kept       .claude/skills (a symlink; the kit does not link into it)" >&2
elif { [ -e "$target/.claude" ] && [ ! -d "$target/.claude" ]; } \
  || { [ -e "$target/.claude/skills" ] && [ ! -d "$target/.claude/skills" ]; }; then
  echo "kept       .claude/skills (not a directory; the kit does not link into it)" >&2
else
  if [ ! -d "$target/.claude/skills" ]; then
    [ "$check" -eq 1 ] || mkdir -p -- "$target/.claude/skills"
    changed "added      .claude/skills"
  fi
  for p in "${paths[@]}"; do
    case "$p" in .agents/skills/*/SKILL.md) ;; *) continue ;; esac
    name=$(basename "$(dirname "$p")")
    link="$target/.claude/skills/$name"
    want="../../.agents/skills/$name"
    # Only an empty name is linked: a symlink the target made itself (to
    # its own version of the skill, say) or a file there is preserved,
    # as a regular file at a managed path is.
    if [ -L "$link" ] && [ "$(readlink -- "$link")" = "$want" ]; then
      echo "unchanged  .claude/skills/$name"
    elif [ ! -L "$link" ] && [ ! -e "$link" ]; then
      [ "$check" -eq 1 ] || ln -s -- "$want" "$link"
      changed "linked     .claude/skills/$name"
    else
      echo "kept       .claude/skills/$name (not the kit's symlink; left as is)" >&2
    fi
  done
fi

path_list=""
for p in "${paths[@]}"; do path_list+="    \"$p\",
"; done
path_list=${path_list%,
}
seed_list=""
for p in "${seeds[@]+"${seeds[@]}"}"; do seed_list+="\"$p\", "; done
seed_list=${seed_list%, }
lock_body=$(printf '{\n  "source": "%s",\n  "ref": "%s",\n  "dirty": %s,\n  "installed": "%s",\n  "issue_forms": "%s",\n  "seeds": [%s],\n  "paths": [\n%s\n  ]\n}\n' \
  "$KIT_SOURCE" "$ref" "$dirty" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$forms" "$seed_list" "$path_list")
same_lock=0
if [ -f "$lock" ] && [ "$dirty" = false ] && [ "$lock_forms" = "$forms" ] \
  && grep -q "\"ref\": \"$ref\"" "$lock" && grep -q '"dirty": false' "$lock" \
  && [ "$(sed -n 's/^    "\([^"]*\)",\{0,1\}$/\1/p' "$lock")" = "$(printf '%s\n' "${paths[@]}")" ]; then
  same_lock=1
fi
if [ "$same_lock" -eq 1 ]; then
  echo "unchanged  .github/gh-agent-kit.lock (ref $ref)"
else
  if [ "$check" -eq 0 ]; then
    mkdir -p -- "$(dirname "$lock")"
    tmp=$(mktemp -- "$(dirname "$lock")/.gh-agent-kit.XXXXXX")
    # As in put: no "--" for chmod, and no temporary file left on a failure.
    if ! printf '%s' "$lock_body" > "$tmp" || ! chmod 0644 "$tmp"; then
      rm -f -- "$tmp"
      exit 1
    fi
    mv -f -- "$tmp" "$lock"
  fi
  changed "wrote      .github/gh-agent-kit.lock (ref $ref, dirty $dirty, issue forms $forms)"
fi

if [ "$check" -eq 1 ]; then
  echo
  if [ "$changes" -eq 0 ]; then
    echo "Check: the target is current with this clone's kit ($ref); nothing to change."
    exit 0
  fi
  echo "Check: an install from this clone ($ref) would make the $changes change(s) above; nothing was written."
  exit 1
fi

# The kit's own skill links, so a new or dropped link shows below too.
links=()
for p in "${paths[@]}" "${prune[@]+"${prune[@]}"}"; do
  case "$p" in .agents/skills/*/SKILL.md)
    name=$(basename "$(dirname "$p")")
    links+=("$target/.claude/skills/$name") ;;
  esac
done
echo
echo "Changes in the target (the kit's files, skill links and AGENTS.md only):"
git -C "$target" --no-pager diff --stat -- "${paths[@]/#/$target/}" "${prune[@]+"${prune[@]/#/$target/}"}" "${links[@]+"${links[@]}"}" "$lock" "$agents" || true
untracked=$(git -C "$target" ls-files --others --exclude-standard -- "${paths[@]/#/$target/}" "${links[@]+"${links[@]}"}" "$lock" 2>/dev/null || true)
[ -z "$untracked" ] || printf 'new:\n%s\n' "$untracked"
echo
echo "Next: edit .github/security-review-instructions.md for this repository, run"
echo ".github/scripts/sync-labels.sh <owner/repo>, and set the secret and"
echo "settings in docs/setup.md."
