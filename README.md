# @pi-kode/file-tools

Standalone `pi` extension package providing file, search, notebook, shell, and checkpoint/rewind tools.

## Capabilities

This package registers the file-tools extension (`./index.ts`) with `pi` and requires no other `@pi-kode` packages.

### Registered Tools

| Tool | Execution Mode | Summary |
| --- | --- | --- |
| `Read` | `parallel` | Reads UTF-8 text files with 1-based line numbers, images visually, notebooks as JSON, and PDFs via `pdftotext`. |
| `Write` | `sequential` | Atomically writes UTF-8 text files with stale-read protection and rewind checkpoints. |
| `Edit` | `sequential` | Performs exact string replacements (`old_string` -> `new_string`, optional `replace_all`) with stale-read protection and rewind checkpoints. |
| `Glob` | `parallel` | Finds files using ripgrep (`rg --files`) and glob matching. |
| `Grep` | `parallel` | Searches file contents using ripgrep (`rg`) regular expressions. |
| `NotebookEdit` | `sequential` | Edits `.ipynb` notebook cells (`replace`, `insert`, `delete`) by cell ID with stale-read protection and rewind checkpoints. |
| `Bash` | `sequential` | Executes foreground `/bin/bash -c` commands in the session working directory with bounded output and artifact logging. |

#### Tool Details

- **`Read`**
  - Requires an absolute `file_path`.
  - **Text files**: Up to 4 MB; defaults to `offset: 1` and `limit: 2000` lines; truncates lines longer than 2000 characters and caps returned output at 64 KB. Rejects binary files containing NUL bytes. Records a SHA-256 content hash so subsequent edits can detect external changes.
  - **Images**: Supports `.png`, `.jpg`, `.jpeg`, `.gif`, and `.webp` (up to 10 MB) and returns them as base64 image content.
  - **PDFs**: Extracts text using `pdftotext -layout` (if installed on `PATH`), supporting a `pages` range of 1–20 pages (default `1-20`).
  - **Notebooks**: Reads `.ipynb` files as UTF-8 JSON and tracks their hash for `NotebookEdit`.
- **`Write`**
  - Requires an absolute `file_path` and `content`.
  - Creates new files or overwrites existing files atomically (preserving existing file mode, defaulting to `0o600` for new files).
  - Refuses to overwrite an existing file unless it was read in the current session and remains unchanged since that read.
- **`Edit`**
  - Requires an absolute `file_path`, `old_string`, `new_string` (must differ), and optional `replace_all`.
  - Refuses to edit files that have not been read or have changed on disk since the last `Read`.
  - Rejects ambiguous matches when `old_string` appears multiple times unless `replace_all: true` is provided.
- **`Glob`**
  - Matches files under `path` (defaults to session `cwd`) using ripgrep file discovery and Node glob matching.
  - Respects ignore files, includes hidden files except `.git`, does not follow directory symlinks, and returns up to 1000 sorted paths.
- **`Grep`**
  - Searches with ripgrep (`rg`), respecting ignore files and including hidden files except `.git`.
  - Supports `output_mode` (`files_with_matches` default, `content`, `count`), `glob`, `-i`, `-n`, `-A`/`-B`/`-C`, `multiline`, `offset`, and `head_limit` (default 200, max 2000).
- **`NotebookEdit`**
  - Edits Jupyter notebooks (`.ipynb`) by `cell_id` with `edit_mode` (`replace` default, `insert`, `delete`) and `cell_type` (`code`, `markdown`).
  - Requires a fresh `Read` of the notebook first; clears stale `outputs` and `execution_count` on edited code cells and strips them when converting to markdown.
- **`Bash`**
  - Runs `/bin/bash -c <command>` in the session `cwd` with optional `timeout` in milliseconds (default 120,000 ms, max 600,000 ms).
  - Supports cancellation via `AbortSignal` (sends `SIGTERM` then `SIGKILL` to the process group).
  - Returns up to 64 KB inline and writes full output (up to 16 MB) to a session output artifact file.

### Checkpoints and Rewind (`/pk-rewind`)

- Every `Write`, `Edit`, and `NotebookEdit` operation records a checkpoint:
  - Previous file contents are stored in a content-addressed blob store under `~/.local/share/pi-code-compat/<cwd-hash>/<session-hash>/blobs/`.
  - Checkpoint history is persisted to the `pi` session branch (`pk:checkpoints`) and restored on `session_start` and `session_tree`.
- The **`/pk-rewind`** command reverts the most recent tracked file edit:
  - Restores the previous file contents from the blob store, or deletes the file if it was newly created.
  - Prompts for confirmation when an interactive UI is available.
  - Detects conflicts and aborts if the file was modified externally after the tracked edit.
  - Shell (`Bash`) and external file modifications are not tracked by checkpoints.

### Runtime Requirements

- Node.js 22+
- `rg` (ripgrep) on `PATH` for `Glob` and `Grep`
- `/bin/bash` for `Bash`
- `pdftotext` on `PATH` (optional, required only for reading `.pdf` files)

## Installation

Install `@pi-kode/file-tools` from the public npm registry (`https://www.npmjs.com/settings/pi-kode/packages`):

```sh
npm install @pi-kode/file-tools
```

Or install it through `pi`'s package manager using the scoped package name `@pi-kode/file-tools`. The committed `.npmrc` routes `@pi-kode` packages to `https://registry.npmjs.org`.

## Contributing & Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, running tests and type checks, architecture guidelines, and the release process.
