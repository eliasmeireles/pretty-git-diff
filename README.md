# [Pretty Git Diff](https://github.com/eliasmeireles/pretty-git-diff)

A VS Code extension that provides powerful Git comparison tools with an intuitive visual interface.

## ✨ Features

### 📁 File Comparison
Compare any file with versions from different branches or commits with side-by-side diff view.

![File Diff Demo](https://github.com/eliasmeireles/pretty-git-diff/blob/main/accets/file-diff.gif?raw=true)

### 📂 Directory Comparison
Compare entire directories between branches with file status indicators and bulk operations.

![Directory Diff Demo](https://github.com/eliasmeireles/pretty-git-diff/blob/main/accets/dir-diff.gif?raw=true)

### 🔄 Apply Changes
Apply changes from any branch or commit directly to your current file.

### Key Benefits
- **Smart branch detection**: Shows both local and remote branches with clear prefixes
- **Bulk operations**: "Get All" option for downloading multiple files at once
- **Intuitive UI**: Clean interface with helpful status icons and descriptions
- Retrieve missing files from remote references
- Support for nested directory structures

## How to Use

### 📁 Compare Current File

**Method 1: Right-click in Editor**
1. Right-click anywhere in the open file
2. Select `Pretty Git Diff: File`
3. Choose reference type (Branches or Commits)
4. Select branch/commit from the list
5. View side-by-side comparison with read-only left panel

**Method 2: Explorer Context Menu**
1. Right-click on any file in the Explorer
2. Select `Pretty Git Diff: File`
3. Follow steps 3-5 above

### 📂 Compare Directory

**Method 1: Command Palette**
1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type `Pretty Git Diff: Directory`
3. Choose workspace root or select specific folder
4. Choose reference type (Branches or Commits)
5. Select branch/commit from the list
6. Browse files with status indicators:
   - 🆕 New files (available in reference)
   - 📝 Modified files
   - 📄 Local only files
7. Use "📥 Get All Files" to download multiple files at once

**Method 2: Explorer Context Menu**
1. Right-click on any folder in the Explorer
2. Select `Pretty Git Diff: Directory`
3. Follow steps 4-7 above

### 🔄 Apply Changes to File

1. Right-click in editor or on file in Explorer
2. Select `Pretty Git Diff: Apply`
3. Choose reference type (Branches or Commits)
4. Select branch/commit to apply changes from
5. File content will be completely replaced

### 🌐 Branch Selection

The extension shows branches with clear prefixes:
- `📁 local/main` - Local branches
- `🌐 origin/feature-branch` - Remote branches
- `📝 abc1234 - commit message (author)` - Recent commits

## Requirements

- Git repository
- VS Code 1.50.0 or higher

## Troubleshooting

### No files/directories selected
If you see warnings about no files selected, make sure to:
- Open a file in the editor before using File commands
- Open a workspace before using Directory commands from Command Palette
- Right-click on files/folders in Explorer for context menu access

### Not a Git repository
If you see "This project is not a Git repository" error:
- Initialize Git in your project: `git init`
- Clone from a Git repository
- Open a folder that contains a `.git` directory

## Support

For issues and feature requests, please check the extension's marketplace page or repository.
