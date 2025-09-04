import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../services/GitService';
import { DirectoryComparisonService } from '../services/DirectoryComparisonService';
import { ReferenceSelectionService } from '../services/ReferenceSelectionService';
import { DiffService } from '../services/DiffService';
import { LanguageUtils } from '../utils';
import { DirectoryFile } from '../types';

export class CompareDirectoryCommand {
    private readonly referenceSelectionService: ReferenceSelectionService;
    private readonly directoryComparisonService: DirectoryComparisonService;
    private readonly diffService: DiffService;

    constructor(private readonly gitService: GitService) {
        this.referenceSelectionService = new ReferenceSelectionService(gitService);
        this.directoryComparisonService = new DirectoryComparisonService(gitService);
        this.diffService = new DiffService(gitService, new LanguageUtils());
    }

    async execute(uri?: vscode.Uri): Promise<void> {
        try {
            let selectedFolder: string;
            
            if (uri) {
                // Called from explorer context menu on a directory
                selectedFolder = uri.fsPath;
            } else {
                // Called from command palette
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showWarningMessage(
                        'Pretty Git Diff: Directory - Please open a workspace or ' +
                        'right-click on a folder in the explorer.'
                    );
                    return;
                }
                const folder = await this.selectDirectory(workspaceFolder.uri.fsPath);
                if (!folder) return;
                selectedFolder = folder;
            }

            // Check if project has git initialized
            let gitRoot: string;
            try {
                gitRoot = await this.gitService.getGitRoot(selectedFolder);
            } catch (gitError: any) {
                vscode.window.showErrorMessage(
                    'Pretty Git Diff: This project is not a Git repository. Please initialize Git first.'
                );
                return;
            }
            
            // Ask user to choose between branches or commits
            const comparisonType = await this.referenceSelectionService.selectComparisonType();
            if (!comparisonType) return;

            // Select reference to compare with
            const reference = await this.referenceSelectionService.selectReference(
                gitRoot,
                comparisonType,
                `Select ${comparisonType} to compare directory with`
            );
            
            if (!reference) return;

            // Show loading message
            const progress = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Comparing directory with ${reference.name}...`,
                cancellable: false
            }, async () => {
                return await this.directoryComparisonService.compareDirectoryWithReference(
                    selectedFolder,
                    reference.name
                );
            });

            // Show results
            await this.showComparisonResults(progress, gitRoot);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Pretty Git Diff: ${error.message}`);
        }
    }

    private async selectDirectory(workspacePath: string): Promise<string | undefined> {
        const options = [
            {
                label: '📁 Current Workspace Root',
                description: 'Compare entire workspace',
                path: workspacePath
            },
            {
                label: '📁 Select Folder...',
                description: 'Choose specific folder to compare',
                path: 'SELECT'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select directory to compare'
        });

        if (!selected) return undefined;

        if (selected.path === 'SELECT') {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Folder'
            });
            
            return folderUri?.[0]?.fsPath;
        }

        return selected.path;
    }

    private async showComparisonResults(
        comparison: any,
        gitRoot: string
    ): Promise<void> {
        interface FileItem {
            label: string;
            description: string;
            detail: string;
            file: DirectoryFile;
            action?: string;
        }

        const fileItems: FileItem[] = comparison.files
            .filter((file: DirectoryFile) => !file.isDirectory)
            .map((file: DirectoryFile) => ({
                label: `${this.directoryComparisonService.getStatusIcon(file)} ${file.relativePath}`,
                description: this.directoryComparisonService.getStatusDescription(file),
                detail: file.path,
                file
            }));

        if (fileItems.length === 0) {
            vscode.window.showInformationMessage('No differences found between directory and reference');
            return;
        }

        // Count files that can be retrieved (exist in remote but not local or are different)
        const retrievableFiles = fileItems.filter(item => 
            !item.file.exists.local || 
            (item.file.exists.local && item.file.exists.remote && item.file.status === 'modified')
        );

        const items: FileItem[] = [];

        // Add "Get All" option if there are multiple retrievable files
        if (retrievableFiles.length > 1) {
            items.push({
                label: '📥 Get All Files',
                description: `Download all ${retrievableFiles.length} files`,
                detail: 'Retrieve all changed/new files from the selected branch',
                file: {} as DirectoryFile,
                action: 'GET_ALL'
            });
        }

        // Add individual files
        items.push(...fileItems);

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Directory comparison results (${fileItems.length} items)`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) return;

        // Handle "Get All" action
        if (selected.action === 'GET_ALL') {
            await this.handleGetAllFiles(retrievableFiles, comparison, gitRoot);
            return;
        }

        await this.handleFileAction(selected.file, comparison, gitRoot);
    }

    private async handleGetAllFiles(
        retrievableFiles: Array<{ file: DirectoryFile }>,
        comparison: any,
        gitRoot: string
    ): Promise<void> {
        const progress = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Retrieving ${retrievableFiles.length} files...`,
            cancellable: false
        }, async (progress) => {
            let completed = 0;
            
            for (const item of retrievableFiles) {
                const file = item.file;
                progress.report({
                    message: `Retrieving ${file.relativePath}...`,
                    increment: (100 / retrievableFiles.length)
                });

                try {
                    if (!file.exists.local || file.status === 'modified') {
                        const relativePath = path.relative(gitRoot, file.path).replace(/\\/g, '/');
                        await this.directoryComparisonService.retrieveRemoteFile(
                            gitRoot, 
                            comparison.reference, 
                            relativePath, 
                            file.path
                        );
                        completed++;
                    }
                } catch (error: any) {
                    vscode.window.showWarningMessage(`Failed to retrieve ${file.relativePath}: ${error.message}`);
                }
            }

            return completed;
        });

        vscode.window.showInformationMessage(`Successfully retrieved ${progress} of ${retrievableFiles.length} files`);
    }

    private async handleFileAction(
        file: DirectoryFile,
        comparison: any,
        gitRoot: string
    ): Promise<void> {
        if (file.isDirectory) {
            vscode.window.showInformationMessage('Directory selected. No actions available for directories.');
            return;
        }

        const actions = [];

        if (file.exists.local && file.exists.remote) {
            actions.push({
                label: '👁️ View Diff',
                action: 'diff'
            });
        }

        if (!file.exists.local && file.exists.remote) {
            actions.push({
                label: '⬇️ Retrieve File',
                action: 'retrieve'
            });
        }

        if (file.exists.local) {
            actions.push({
                label: '📖 Open Local File',
                action: 'open'
            });
        }

        if (actions.length === 0) {
            vscode.window.showInformationMessage('No actions available for this file');
            return;
        }

        const selectedAction = await vscode.window.showQuickPick(actions, {
            placeHolder: `What would you like to do with ${file.relativePath}?`
        });

        if (!selectedAction) return;

        switch (selectedAction.action) {
            case 'diff':
                await this.showFileDiff(file, comparison.reference, gitRoot);
                break;
            case 'retrieve':
                await this.retrieveFile(file, comparison.reference, gitRoot);
                break;
            case 'open':
                await this.openLocalFile(file);
                break;
        }
    }

    private async showFileDiff(file: DirectoryFile, reference: string, gitRoot: string): Promise<void> {
        try {
            await this.diffService.openCurrentFileDiff(file.path, reference);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to show diff: ${error.message}`);
        }
    }

    private async retrieveFile(file: DirectoryFile, reference: string, gitRoot: string): Promise<void> {
        const relativePath = path.relative(gitRoot, file.path).replace(/\\/g, '/');
        await this.directoryComparisonService.retrieveRemoteFile(gitRoot, reference, relativePath, file.path);
    }

    private async openLocalFile(file: DirectoryFile): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(file.path);
        await vscode.window.showTextDocument(doc);
    }

}
