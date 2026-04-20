#!/usr/bin/env bash
set -euo pipefail

PREVIEW_BRANCH="preview"
BASE_BRANCH=""
DRY_RUN=false

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Create or update a preview branch by merging every local branch except:
  - main
  - the preview branch itself
  - the selected base branch

Options:
  -p, --preview <name>   Preview branch name (default: preview)
  -b, --base <name>      Base branch to start preview from (default: current branch)
      --dry-run          Print planned actions without changing git state
  -h, --help             Show help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--preview)
      PREVIEW_BRANCH="$2"
      shift 2
      ;;
    -b|--base)
      BASE_BRANCH="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This must be run inside a git repository." >&2
  exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Detached HEAD is not supported. Checkout a branch first." >&2
  exit 1
fi

if [[ -z "$BASE_BRANCH" ]]; then
  BASE_BRANCH="$CURRENT_BRANCH"
fi

if [[ "$BASE_BRANCH" == "main" ]]; then
  echo "Refusing to use main as base branch (per safety policy)." >&2
  exit 1
fi

if [[ "$PREVIEW_BRANCH" == "main" ]]; then
  echo "Refusing to use main as preview branch name." >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$BASE_BRANCH"; then
  echo "Base branch '$BASE_BRANCH' was not found locally." >&2
  exit 1
fi

mapfile -t ALL_BRANCHES < <(git for-each-ref --format='%(refname:short)' refs/heads)
MERGE_CANDIDATES=()

for BRANCH in "${ALL_BRANCHES[@]}"; do
  if [[ "$BRANCH" == "main" || "$BRANCH" == "$PREVIEW_BRANCH" || "$BRANCH" == "$BASE_BRANCH" ]]; then
    continue
  fi
  MERGE_CANDIDATES+=("$BRANCH")
done

if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] Current branch: $CURRENT_BRANCH"
  echo "[dry-run] Base branch: $BASE_BRANCH"
  echo "[dry-run] Preview branch: $PREVIEW_BRANCH"
  if [[ ${#MERGE_CANDIDATES[@]} -eq 0 ]]; then
    echo "[dry-run] No merge candidates found."
  else
    printf '[dry-run] Branches to merge (%d): %s\n' "${#MERGE_CANDIDATES[@]}" "${MERGE_CANDIDATES[*]}"
  fi
  exit 0
fi

cleanup() {
  if [[ $(git branch --show-current) != "$CURRENT_BRANCH" ]]; then
    git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if git show-ref --verify --quiet "refs/heads/$PREVIEW_BRANCH"; then
  echo "Updating existing '$PREVIEW_BRANCH' branch."
  git checkout "$PREVIEW_BRANCH"
else
  echo "Creating '$PREVIEW_BRANCH' from '$BASE_BRANCH'."
  git checkout -b "$PREVIEW_BRANCH" "$BASE_BRANCH"
fi

if [[ ${#MERGE_CANDIDATES[@]} -eq 0 ]]; then
  echo "No branches to merge. '$PREVIEW_BRANCH' is already up to date from '$BASE_BRANCH'."
  exit 0
fi

for BRANCH in "${MERGE_CANDIDATES[@]}"; do
  if git merge-base --is-ancestor "$BRANCH" "$PREVIEW_BRANCH"; then
    echo "Skipping '$BRANCH' (already included in '$PREVIEW_BRANCH')."
    continue
  fi

  echo "Merging '$BRANCH' into '$PREVIEW_BRANCH'..."
  if ! git merge --no-ff "$BRANCH" -m "merge(preview): integrate $BRANCH"; then
    echo "Conflict while merging '$BRANCH'. Resolve manually, then continue or abort with: git merge --abort" >&2
    exit 1
  fi
done

echo "Preview branch '$PREVIEW_BRANCH' is ready."
