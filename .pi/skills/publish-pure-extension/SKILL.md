---
name: publish-pure-extension
description: Publish a pure-* extension to npm. Bumps version, updates changelog, validates, and publishes. Use when the user asks to publish, release, or push an extension to npm.
---

# Publish Pure Extension

Publish a `pure-*` or `pi-*` extension from the mono repo to npm as `@gaodes/pi-pure-<name>`.

The `pi-devkit` extension is the exception — it uses `@gaodes/pi-devkit` (no `pure` prefix) since it's a generic development tool.

## Versioning Policy

Default to **patch**. Only bump minor or major for significant changes.

| Bump | When to use | Examples |
|------|------------|----------|
| **Patch** (0.0.x) | Bug fixes, small improvements, minor features, refactors, config changes | Fix a crash, add a config option, improve error handling, update docs |
| **Minor** (0.x.0) | Major new features, significant behavior additions, new tools/commands | Add a new tool, new command, new skill, new UI component |
| **Major** (x.0.0) | Breaking changes, complete rewrites, removed features | Change config format (breaking), remove a tool, change tool signatures |

**Rules of thumb:**
- If it doesn't break anything and isn't a big new capability → **patch**
- If users need to update their config or learn new features → **minor**
- If existing setups will break → **major**
- When in doubt → **patch**

## Pre-flight Checklist

Before publishing, verify:

### 1. Identify the Extension

The user specifies which extension to publish. Resolve the directory:

```bash
ls extensions/<name>/package.json
```

### 2. Check Git Status

```bash
git status
git diff --stat
```

All changes for this extension must be committed before publishing. If uncommitted changes exist, ask the user whether to commit them first.

### 3. Biome Check

```bash
biome check extensions/<name>/
```

Zero errors required. Fix any issues before proceeding.

### 4. Smoke Test

```bash
pi -e "$PWD/extensions/<name>" -ne -p "reply with just ok" 2>&1 | tail -5
```

Must produce a valid response, not an error.

## Version Bump

### 1. Read Current Version

```bash
# From the extension's package.json
cat extensions/<name>/package.json | python3 -c "import json,sys; print(json.load(sys.stdin)['version'])"
```

Also check the CHANGELOG for the latest version to make sure they're in sync.

### 2. Determine Bump Level

Read the CHANGELOG and recent commits to assess changes since last publish:

```bash
git log --oneline <last-tag-or-commit>..HEAD -- extensions/<name>/
```

Apply the versioning policy above. Default to **patch** unless the changes clearly warrant minor or major.

### 3. Bump the Version

Update **both** files:

- `extensions/<name>/package.json` — `version` field
- `extensions/<name>/CHANGELOG.md` — add new version header (if not already present)

Use `edit` to make precise changes. Example version bump from `0.3.2` to `0.3.3`:

In `package.json`:
```json
"version": "0.3.3",
```

In `CHANGELOG.md`, prepend:
```markdown
## [0.3.3] - YYYY-MM-DD

### Fixed
- Description of the fix
```

Use today's date. Follow [Keep a Changelog](https://keepachangelog.com/) format:
- `### Added` for new features
- `### Changed` for changes in existing functionality
- `### Fixed` for bug fixes
- `### Removed` for removed features

## Publish

### 1. Retrieve npm Token

The npm automation token is stored in 1Password:

```bash
source /Users/elche/op_service_account_token.zsh
TOKEN=$(op item get "NPM Pi Agent Token" --vault "Agents" --reveal 2>&1 | grep credential | awk '{print $2}')
echo "//registry.npmjs.org/:_authToken=$TOKEN" > ~/.npmrc
```

The token is a **Classic Automation** type — it bypasses 2FA/OTP.

### 2. Pack and Verify

Dry-run first to check tarball contents:

```bash
cd extensions/<name> && npm pack --dry-run 2>&1
```

Verify:
- Package name is `@gaodes/pi-pure-<name>` (or `@gaodes/pi-devkit` for the devkit)
- Files are correct (no unexpected files, no missing files)
- `.npmignore` excludes `node_modules/`, `CHANGELOG.md`, `.DS_Store`

### 3. Publish

```bash
cd extensions/<name> && npm publish --access public 2>&1
```

Successful output ends with:
```
+ @gaodes/pi-pure-<name>@X.Y.Z
```

If it fails with `EPUBLISHCONFLICT`, the version already exists — bump and retry.

## Post-publish

### 1. Commit and Push

```bash
git add extensions/<name>/package.json extensions/<name>/CHANGELOG.md
git commit -m "release: @gaodes/pi-pure-<name>@X.Y.Z"
git push
```

### 2. Update Global Settings

After publishing, the extension can be installed from npm instead of the git source. Update `~/.pi/agent/settings.json`:

**Before** (git source):
```json
{
  "source": "git:github.com/gaodes/pi-pure-ecosystem",
  "extensions": [
    "extensions/<name>/index.ts",
    ...
  ]
}
```

**After** (add npm package alongside git source):
```json
"packages": [
  "npm:@gaodes/pi-pure-<name>",
  ...
]
```

Only do this if the user wants to switch from git to npm source. The git source works fine for development; npm is for distributing to others.

### 3. Verify

```bash
npm view @gaodes/pi-pure-<name> version
```

## Batch Publishing

To publish multiple extensions at once, process them one at a time (serial — npm publish has side effects). For each:

1. Determine version bump (patch by default)
2. Update `package.json` and `CHANGELOG.md`
3. Commit
4. Publish
5. Verify

Ask the user to confirm before batch publishing.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `EOTP` | Wrong token type | Ensure the token is **Classic Automation**, not Granular |
| `EPUBLISHCONFLICT` | Version already published | Bump version and retry |
| `E403` | Scope not owned | Verify `@gaodes` scope ownership on npm |
| `ENEEDAUTH` | Not logged in | Run the token retrieval step |

## npm Token Reference

- **Location**: 1Password → "Agents" vault → "NPM Pi Agent Token"
- **Type**: Classic Automation (bypasses 2FA)
- **Scope**: `@gaodes`
- **Registry**: `https://registry.npmjs.org/`
