# hamakom-app

## Branch preview merge helper

Use `scripts/merge-to-preview.sh` to combine all local feature branches into a single preview branch without touching `main`.

```bash
# from your current branch (default base)
./scripts/merge-to-preview.sh

# choose a non-main base branch
./scripts/merge-to-preview.sh --base work

# preview actions only
./scripts/merge-to-preview.sh --dry-run
```

### Safety rules

- Never uses `main` as base or preview branch.
- Skips branches already included in preview.
- Restores your original branch when done.
