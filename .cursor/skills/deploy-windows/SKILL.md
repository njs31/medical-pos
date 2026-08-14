---
name: deploy-windows
description: >-
  Deploys Pharmacy POS to Windows shops via GitHub releases: version bump,
  commit, push, and electron-builder publish. Use when the user says deploy,
  release, publish Windows build, ship update, dist:win publish, or asks to
  push a new installer to GitHub for auto-update.
---

# Deploy Windows (Pharmacy POS)

When the user says **deploy** (or equivalent), run this full sequence without asking for confirmation unless a step fails.

## Version bump

Default to **patch** for bug fixes. Use **minor** only if the user asks for a feature release or says "minor".

```bash
npm version patch --no-git-tag-version    # 1.8.1 → 1.8.2 (bug fixes)
# or
npm version minor --no-git-tag-version    # 1.8.x → 1.9.0 (new features)
```

Skip the bump only if `package.json` was already bumped for this release and there is nothing else to version.

## Commit and push

```bash
git add .
git commit -m "changes"
git push origin main
```

- Follow the repo git safety rules (no force push, no amend unless required, no secrets).
- If there is nothing to commit after the version bump, still ensure `package.json` / lockfile changes are committed.
- Commit message stays `"changes"` unless the user specifies another message.

## Build and publish

```bash
npm run dist:win -- --publish always
```

- Run from the repo root.
- This builds the Windows x64 installer/portable and publishes to GitHub (`njs31/medical-pos`).
- Wait for completion. If publish fails because tag `vX.Y.Z` already exists as a published release while electron-builder wants a draft, report that and fix (delete conflicting release/tag or bump version) before retrying.
- If 7-Zip/locale packaging flakes on Mac, clean `release/win-unpacked` if needed and retry once.

## After success

Tell the user:
1. New version number from `package.json`
2. That GitHub release publish finished (or failed, with the error)
3. Shop PCs need to update to that version for the fix to apply
