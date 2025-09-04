# Pretty Git Diff

A VS Code extension that allows comparing Git branches and commits similar to JetBrains tools.

## Features

### 🆚 Compare Branches and Commits

- Compare any two branches or commits
- Visual selection with icons for easy identification
- View list of changed files with status indicators
- Side-by-side diff view for any file

### 📁 Compare Current File

- Compare current file with version from another branch or commit
- Quick access via right-click context menu
- Smart reference selection

### 🔄 Apply Changes

- Apply changes from any branch or commit to current file
- Complete file replacement with selected reference
- Works with local branches, remote branches, and specific commits

### 📂 Directory Comparison

- Compare entire directories between references
- Visual file listing with status indicators
- Retrieve missing files from remote references
- Support for nested directory structures

## How to Use

### Compare Two References

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type `Compare Branches...`
3. Choose: Branches or Commits
4. Select first reference
5. Select second reference
6. Pick file to view diff

### Compare Current File

1. Right-click in editor
2. Select `Compare File With Branch...`
3. Choose reference type and select from list
4. View side-by-side comparison

### Apply Changes to File

1. Right-click in editor
2. Select `Apply Branch Changes to File`
3. Choose reference to apply changes from
4. File content will be replaced

### Compare Directory

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type `Pretty Git Diff: Directory comparison`
3. Select directory (workspace root or specific folder)
4. Choose reference type and select from list
5. Browse files with status indicators
6. Retrieve missing files or view diffs

## Installation

1. Download the `.vsix` file
2. In VS Code: Extensions → Install from VSIX
3. Select the downloaded file

## Requirements

- Git repository
- At least 2 branches for branch comparison
