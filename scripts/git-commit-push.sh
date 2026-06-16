#!/usr/bin/env bash
# Commit without co-author trailers (uses commit-tree) and push via SSH as favourawaku.
# Requires repo-local config: user.name, user.email, core.sshCommand (~/.ssh/awaku).
set -euo pipefail

AUTHOR_NAME="favourawaku"
AUTHOR_EMAIL="sabofavour4@gmail.com"

usage() {
  cat <<'EOF'
Usage: scripts/git-commit-push.sh [-m "commit message"] [files...]

Stages the given files (or all changes if none listed), creates a commit via
commit-tree (no co-author), and pushes HEAD over SSH as favourawaku.

Examples:
  scripts/git-commit-push.sh -m "feat: add login endpoint" src/auth.ts
  scripts/git-commit-push.sh -m "fix: handle null user"
EOF
}

message=""
files=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      message="${2:?missing value for $1}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      files+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$message" ]]; then
  echo "error: commit message required (-m)" >&2
  usage >&2
  exit 1
fi

if [[ ${#files[@]} -gt 0 ]]; then
  git add -- "${files[@]}"
else
  git add -A
fi

if git diff --cached --quiet; then
  echo "error: nothing staged to commit" >&2
  exit 1
fi

tree=$(git write-tree)
parent=$(git rev-parse HEAD)
export GIT_AUTHOR_NAME="$AUTHOR_NAME"
export GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL"
export GIT_COMMITTER_NAME="$AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL"
new=$(git commit-tree "$tree" -p "$parent" -m "$message")
git reset --hard "$new"

echo "Created commit:"
git log -1 --format='%H%n%an <%ae>%n%B'

git push -u origin HEAD
