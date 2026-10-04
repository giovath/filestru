# FileStru

> Put your files in order.

Simple, local file organization.

FileStru is a lightweight Windows desktop application designed to help users understand and organize their local files with a clear review-before-execution workflow.

## What FileStru does

FileStru scans a selected folder, analyzes its files using deterministic organization rules, and presents a proposed organization before making any changes.

The current workflow is:

1. Select a folder
2. Scan its contents
3. Review the proposed organization
4. Confirm the operation
5. FileStru creates the necessary folders and moves the files

The application is designed to make file organization predictable and transparent rather than hiding filesystem changes behind automation.

## Current version

**0.1.0**

Windows-first release.

The initial version focuses on deterministic local file organization without requiring an account, cloud storage, or AI.

## Principles

### Local-first

FileStru works with files stored locally on the user's computer.

### Preview before execution

FileStru shows the proposed organization before changing the filesystem.

### Preserve existing structure

FileStru does not flatten nested folders when organizing a selected directory. Existing subfolder structures are preserved.

### Simple by default

The first version intentionally avoids unnecessary accounts, cloud infrastructure, background services, or complex configuration.

### Deterministic organization

The initial organization engine uses explicit rules to classify files and generate an organization plan.

AI-assisted organization may be introduced in future versions, but it is not required for the core functionality.

## Technology

FileStru is built with:

- Tauri 2
- Rust
- TypeScript
- HTML/CSS
- Vite

The application runs as a native desktop application while keeping the interface lightweight.

## Development

Install dependencies:

```bash
npm install