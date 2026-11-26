# Contributing to @pi-kode/file-tools

Thank you for contributing to `@pi-kode/file-tools`. This guide covers local setup, codebase layout, development conventions, testing, and the release process.

## Prerequisites

- **Node.js 22+** (the test runner uses `node --experimental-strip-types`)
- **npm**
- **`rg` (ripgrep)** installed and available on `PATH` (used by `Glob` and `Grep`)
- **`/bin/bash`** (used by `Bash`)
- **`pdftotext`** (optional; used by `Read` when extracting text from `.pdf` files)

## Getting Started

Clone the repository and install dependencies:

```sh
npm install
```

> Note: This repository intentionally does not commit a `package-lock.json`.

Run typechecking and tests to verify your environment:

```sh
npm run typecheck
npm test
```

## Project Layout

```text
.
├── index.ts                          # Package entry point (re-exports extension installer)
├── lib/src/
│   ├── features/
│   │   └── tools.ts                  # Extension entry: lifecycle hooks, tool registration, /pk-rewind command
│   ├── extensions/
│   │   ├── tools.ts                  # Read, Write, Edit, Glob, Grep, NotebookEdit, Bash implementations
│   │   └── checkpoints.ts            # trackedWrite() and rewindFile() checkpoint logic
│   ├── runtime/
│   │   ├── files.ts                  # FileToolsRuntime (state, session persistence, schema validation, tool registration)
│   │   └── utils.ts                  # SHA-256 hashing, canonical path resolution, atomic writes, helpers
│   └── backends/
│       └── process.ts                # Process execution with timeout, abort signal, output bounds, and artifact files
├── tests/
│   ├── helper.ts                     # In-memory pi ExtensionAPI harness with isolated temp directory
│   └── files.test.ts                 # Extension tests using node:test
├── .github/workflows/publish.yaml    # Automated npm publish workflow on vX.X.X-release tags
├── package.json
└── tsconfig.json
```

## Development Conventions

### TypeScript and Modules

- The package is pure ESM (`"type": "module"`) with strict TypeScript (`tsconfig.json` uses `"module": "NodeNext"`, `"strict": true`, `"noEmit": true`, and `"allowImportingTsExtensions": true`).
- Always include explicit `.ts` extensions on relative imports (for example, `import { runProcess } from '../backends/process.ts';`).
- There is no build/transpile step; `pi` loads `./index.ts` directly and Node runs tests directly via `--experimental-strip-types`.

### Tool Registration and Safety Guarantees

- Define tool input schemas with `typebox` (`object(...)` with `additionalProperties: false`). `FileToolsRuntime.register` validates every invocation against the schema before running the handler.
- Set `write = false` (`executionMode: 'parallel'`) for read-only tools and `write = true` (`executionMode: 'sequential'`) for mutating or shell tools.
- File paths for `Read`, `Write`, `Edit`, and `NotebookEdit` must be absolute and canonicalized via `canonical()`.
- Mutating file tools must enforce stale-read checks against `runtime.readVersions` and write via `trackedWrite()` so writes are atomic and rewindable.
- Preserve existing compatibility identifiers (such as the event channel `pi-ko:file-tools:v1`, session entry types `pk:checkpoints` / `cc:checkpoints` / `code-compat:state`, and store path `~/.local/share/pi-code-compat`).

## Testing

Tests use Node's built-in test runner (`node:test`) and `node:assert/strict`:

```sh
npm test
```

When adding or modifying behavior:

1. Use `harness(install)` from `tests/helper.ts` to test tool execution, session events, and commands in an isolated temporary directory.
2. Always clean up with `t.after(() => h.close())`.
3. Run both `npm run typecheck` and `npm test` before opening a pull request.

## Releasing & publishing

Packages are published to the `@pi-kode` npm organization (`https://www.npmjs.com/settings/pi-kode/packages`) automatically by `.github/workflows/publish.yaml` using **npm OIDC Trusted Publishing** (no `NPM_TOKEN` secret required).

Publishing is triggered **only** when a tag matching `vX.X.X-release` (for example `v0.6.1-release`) is pushed to GitHub.

### Release steps

1. Bump `"version"` in `package.json`, e.g. `0.6.1`, and merge the version bump into `main`.
2. Create and push an annotated tag matching `v<version>-release`:

   ```sh
   git tag -a v0.6.1-release -m "Release v0.6.1"
   git push origin v0.6.1-release
   ```

3. The `Publish` workflow runs the `verify` job to validate that:
   - the tag strictly matches `^v[0-9]+\.[0-9]+\.[0-9]+-release$`,
   - the tag version matches `package.json` `"version"`,
   - the package name is scoped under `@pi-kode/`,
   - `npm test` and `npm run typecheck` pass.
4. Once `verify` passes, the `publish` job pauses at the `npm-publish` GitHub Actions environment. Open the workflow run in GitHub Actions and click **Review deployments** → **Approve and deploy** to run `npm publish --provenance --access public`.

### One-time release setup (maintainers)

1. **GitHub Actions environment** (in repository **Settings → Environments**):
   - Create an environment named `npm-publish`.
   - Enable **Required reviewers** and add the maintainer(s) authorized to approve releases.
2. **npm Trusted Publishing** (in package settings for `@pi-kode/file-tools` under `https://www.npmjs.com/settings/pi-kode/packages`):
   - **Organization / user**: `pi-kode`
   - **Repository**: `filetools`
   - **Workflow filename**: `publish.yaml`
   - **Environment**: `npm-publish`
